// Shared helpers for Claude Code hooks. Hooks receive one JSON object on stdin
// (https://code.claude.com/docs/en/hooks) and must never hang or crash the session.
import { pathToFileURL } from 'node:url';

/** Returns the parsed hook input, or null when stdin is not valid JSON (callers decide open/closed). */
export async function readHookInput() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function isMain(metaUrl) {
  return Boolean(process.argv[1]) && metaUrl === pathToFileURL(process.argv[1]).href;
}
