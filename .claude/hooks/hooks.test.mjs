import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { plan } from './format-lint.mjs';
import { checkToolCall } from './guard-secrets.mjs';
import { changedSourceFiles, shouldRun } from './stop-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('guard-secrets', () => {
  it('blocks reading env and key files', () => {
    assert.ok(checkToolCall('Read', { file_path: '/repo/.env.local' }));
    assert.ok(checkToolCall('Read', { file_path: '.env' }));
    assert.ok(checkToolCall('Edit', { file_path: 'certs/server.pem' }));
    assert.ok(checkToolCall('Bash', { command: 'cat .env.local | head' }));
    assert.ok(checkToolCall('Bash', { command: "grep KEY '.env.production'" }));
    assert.ok(checkToolCall('Bash', { command: 'cat ~/.ssh/id_ed25519' }));
    assert.ok(checkToolCall('Grep', { pattern: 'KEY', path: '.env' }));
  });

  it('blocks env dumps and remote env pulls', () => {
    assert.ok(checkToolCall('Bash', { command: 'printenv' }));
    assert.ok(checkToolCall('Bash', { command: 'env | sort' }));
    assert.ok(checkToolCall('Bash', { command: 'echo $ANTHROPIC_API_KEY' }));
    assert.ok(checkToolCall('Bash', { command: 'vercel env pull' }));
  });

  it('treats unknown env variants as secrets', () => {
    assert.ok(checkToolCall('Bash', { command: 'cp .env.example .env.example.bak' }));
  });

  it('allows the example file and ordinary work', () => {
    assert.equal(checkToolCall('Read', { file_path: '.env.example' }), null);
    assert.equal(checkToolCall('Bash', { command: 'cat .env.example && npm test' }), null);
    assert.equal(checkToolCall('Read', { file_path: 'src/shared/redact.ts' }), null);
    assert.equal(checkToolCall('Bash', { command: 'npm run lint && git status' }), null);
    assert.equal(checkToolCall('Bash', { command: 'cross-env NODE_ENV=test vitest run' }), null);
    assert.equal(checkToolCall('WebSearch', { query: '.env' }), null);
  });

  it('exits 2 with a reason when run as a hook', () => {
    const res = spawnSync('node', [path.join(here, 'guard-secrets.mjs')], {
      input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: '.env.local' } }),
      encoding: 'utf8',
    });
    assert.equal(res.status, 2);
    assert.match(res.stderr, /environment file/);
  });

  it('fails closed on malformed input', () => {
    const res = spawnSync('node', [path.join(here, 'guard-secrets.mjs')], {
      input: 'not json',
      encoding: 'utf8',
    });
    assert.equal(res.status, 2);
  });

  it('sees through quoting, globs and redirection (security-reviewer findings)', () => {
    for (const command of [
      "git diff --no-index /dev/null .e''nv.local",
      'git diff --no-index /dev/null .env.l*',
      'cat<.env',
      'cat .e\\nv',
      'ls -a && cat .e*',
      'head .en?.local',
      'node -p process.env',
      'export -p',
      'set',
      'cat /proc/self/environ',
      'echo ${ANTHROPIC_API_KEY}',
    ]) {
      assert.ok(checkToolCall('Bash', { command }), `should block: ${command}`);
    }
  });
});

describe('format-lint plan', () => {
  const root = '/repo';
  it('formats and lints source files', () => {
    assert.deepEqual(plan(root, '/repo/src/App.tsx'), {
      rel: 'src/App.tsx',
      format: true,
      lint: true,
    });
    assert.deepEqual(plan(root, 'docs/perf.md'), {
      rel: 'docs/perf.md',
      format: true,
      lint: false,
    });
  });
  it('skips generated, vendored, unsupported and outside files', () => {
    assert.ok(plan(root, '/repo/public/data/findings.json').skip);
    assert.ok(plan(root, '/repo/node_modules/x/index.js').skip);
    assert.ok(plan(root, '/repo/public/favicon.svg').skip);
    assert.ok(plan(root, '/etc/passwd').skip);
    assert.ok(plan(root, undefined).skip);
  });
});

describe('stop-check', () => {
  const porcelain = ' M src/App.tsx\n?? docs/notes.md\n M public/data/findings.json\n';
  it('only considers source changes', () => {
    assert.deepEqual(changedSourceFiles(porcelain), ['src/App.tsx']);
  });
  it('never re-blocks while already continuing from a Stop hook', () => {
    assert.equal(shouldRun({ stop_hook_active: true }, porcelain), false);
    assert.equal(shouldRun({ stop_hook_active: false }, porcelain), true);
    assert.equal(shouldRun({}, '?? docs/notes.md\n'), false);
  });
});
