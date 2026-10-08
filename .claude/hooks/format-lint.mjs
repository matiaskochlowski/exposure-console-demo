#!/usr/bin/env node
// PostToolUse(Edit|Write|MultiEdit): format and lint the file Claude just touched.
// Uses the project's installed binaries (never downloads), skips generated/unsupported files, and
// tolerates half-finished edits: a file that does not parse yet is left for the Stop check.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { isMain, readHookInput } from './lib.mjs';

const FORMAT = /\.(tsx?|jsx?|mjs|cjs|json|css|md|ya?ml|html)$/;
const LINT = /\.(tsx?|jsx?|mjs)$/;
const SKIP =
  /(^|\/)(node_modules|dist|coverage|public\/data|playwright-report|test-results|\.vercel)\/|package-lock\.json$/;

/** Decide what to run for a path; exported for tests. */
export function plan(projectDir, filePath) {
  if (!filePath) return { skip: 'no file path' };
  const abs = path.resolve(projectDir, filePath);
  const rel = path.relative(projectDir, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return { skip: 'outside project' };
  if (SKIP.test(rel)) return { skip: 'generated or vendored' };
  if (!FORMAT.test(rel)) return { skip: 'unsupported type' };
  return { rel, format: true, lint: LINT.test(rel) };
}

function run(projectDir, bin, args) {
  const exe = path.join(projectDir, 'node_modules', '.bin', bin);
  if (!existsSync(exe)) return { status: 0, output: '' };
  // Arguments are passed as an array (no shell), so paths with spaces or metacharacters are safe.
  const res = spawnSync(exe, args, { cwd: projectDir, encoding: 'utf8', timeout: 60_000 });
  return { status: res.status ?? 1, output: `${res.stdout ?? ''}${res.stderr ?? ''}`.trim() };
}

if (isMain(import.meta.url)) {
  const input = await readHookInput();
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input?.cwd || process.cwd();
  const decision = plan(projectDir, input?.tool_input?.file_path);
  if (decision.skip || !existsSync(path.join(projectDir, decision.rel))) process.exit(0);

  const fmt = run(projectDir, 'prettier', ['--write', '--log-level', 'warn', '--', decision.rel]);
  if (fmt.status !== 0) process.exit(0); // probably mid-edit and not parseable yet
  if (decision.lint) {
    const lint = run(projectDir, 'eslint', ['--fix', '--no-warn-ignored', '--', decision.rel]);
    if (lint.status !== 0 && lint.output) {
      // Exit 2 on PostToolUse feeds stderr back to Claude so it fixes the problem now.
      process.stderr.write(
        `ESLint found problems in ${decision.rel}:\n${lint.output.slice(0, 4000)}\n`,
      );
      process.exit(2);
    }
  }
}
