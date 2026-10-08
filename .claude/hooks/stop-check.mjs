#!/usr/bin/env node
// Stop hook: before Claude ends a turn that changed source, run `npm run check:fast`
// (typecheck + unit tests). On failure it blocks the stop once and hands Claude the output.
// stop_hook_active is true when Claude is already continuing because of this hook; we then let it
// stop, so a persistent failure surfaces to the human instead of looping.
import { spawnSync } from 'node:child_process';
import { isMain, readHookInput } from './lib.mjs';

const SOURCE = /\.(tsx?|mjs|json)$/;

export function changedSourceFiles(porcelain) {
  return porcelain
    .split('\n')
    .map((line) => line.slice(3).trim())
    .filter((file) => file && SOURCE.test(file) && !file.startsWith('public/data/'));
}

export function shouldRun(input, porcelain) {
  if (input.stop_hook_active) return false;
  return changedSourceFiles(porcelain).length > 0;
}

if (isMain(import.meta.url)) {
  const input = (await readHookInput()) ?? {};
  const cwd = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const status = spawnSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' });
  if (!shouldRun(input, status.stdout ?? '')) process.exit(0);

  const check = spawnSync('npm', ['run', '--silent', 'check:fast'], {
    cwd,
    encoding: 'utf8',
    timeout: 170_000,
  });
  if (check.status !== 0) {
    const output = `${check.stdout ?? ''}${check.stderr ?? ''}`
      .trim()
      .split('\n')
      .slice(-60)
      .join('\n');
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason: `npm run check:fast failed. Fix it before finishing:\n${output}`,
      }),
    );
  }
}
