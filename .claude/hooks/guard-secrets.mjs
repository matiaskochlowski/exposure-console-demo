#!/usr/bin/env node
// PreToolUse guard: refuse tool calls that would read or write secret material.
// Best-effort only. It sees the command text, not what a program does at runtime (a test file can
// still open a secret itself), so it complements permissions.deny and is not a sandbox.
// See docs/claude-code.md.
import { isMain, readHookInput } from './lib.mjs';

/**
 * Undo the cheap shell obfuscations a path check would otherwise miss: quotes and backslashes are
 * removed (`.e''nv` → `.env`, `.e\nv` → `.env`).
 */
export function normalize(text) {
  return String(text ?? '').replace(/['"`\\]/g, '');
}

// `.env` anywhere, except exactly `.env.example` (not `.env.example.bak` and friends).
const ENV_FILE = /\.env(?!\.example(?![\w.-]))/i;
// Globs that could expand to an env file: `.e*`, `.en?`, `.e[n]v`, `.{env,x}`.
const ENV_GLOB = /\.e(?:n)?[*?[{]|\.\{/i;
const KEY_FILE =
  /(?:^|[^\w])(?:[\w.-]*\.(?:pem|key|p12|pfx)|id_(?:rsa|ed25519|ecdsa)[\w.-]*|\.npmrc|\.netrc|credentials(?:\.json)?)(?![\w.-])/i;
const ENV_DUMP =
  /(?:^|[;&|(]\s*)(?:printenv|env|export\s+-p|set|declare\s+-x)\s*(?:$|[;&|)])|process\.env|import\.meta\.env|\/proc\/[\w/]*environ|\$\{?ANTHROPIC_|vercel\s+env\s+pull/i;

/** Returns a reason string when the call must be blocked, otherwise null. */
export function checkToolCall(toolName, toolInput = {}) {
  const candidates = [];
  if (['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(toolName)) {
    candidates.push(toolInput.file_path ?? toolInput.notebook_path ?? '');
  } else if (toolName === 'Grep' || toolName === 'Glob') {
    candidates.push(toolInput.path ?? '', toolInput.glob ?? '', toolInput.pattern ?? '');
  } else if (toolName === 'Bash') {
    const command = normalize(toolInput.command);
    if (ENV_DUMP.test(command))
      return 'Dumping environment variables or pulling remote env files can expose credentials.';
    candidates.push(command);
  } else {
    return null;
  }
  for (const raw of candidates) {
    const value = normalize(raw);
    if (ENV_FILE.test(value) || ENV_GLOB.test(value)) {
      return 'This touches an environment file (or a glob that could match one). Secrets stay out of agent context (docs/security-ai.md).';
    }
    const key = value.match(KEY_FILE);
    if (key)
      return `"${key[0].replace(/^[^\w.]/, '')}" looks like a secret file. Secrets stay out of agent context (docs/security-ai.md).`;
  }
  return null;
}

if (isMain(import.meta.url)) {
  const input = await readHookInput();
  // Fail closed: if we cannot read the call, we cannot vouch for it.
  const reason = input
    ? checkToolCall(input.tool_name, input.tool_input ?? {})
    : 'Hook input was not valid JSON; blocking to be safe.';
  if (reason) {
    // Exit code 2 blocks the tool call and shows stderr to Claude.
    process.stderr.write(`Blocked by .claude/hooks/guard-secrets.mjs: ${reason}\n`);
    process.exit(2);
  }
}
