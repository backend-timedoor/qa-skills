import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.resolve(here, '..', 'sync.sh');

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-sync-'));
  fs.mkdirSync(path.join(root, 'shared/launch-checks/lib'), { recursive: true });
  fs.mkdirSync(path.join(root, 'shared/launch-checks/test'), { recursive: true });
  fs.writeFileSync(path.join(root, 'shared/launch-checks/lib/a.js'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(root, 'shared/launch-checks/test/t.test.js'), '// not shipped\n');
  fs.mkdirSync(path.join(root, 'plugins/pre-launch-check'), { recursive: true });
  fs.mkdirSync(path.join(root, 'plugins/post-launch-check'), { recursive: true });
  return root;
}
const run = (root, ...args) => spawnSync('bash', [script, ...args], { env: { ...process.env, LC_ROOT: root }, encoding: 'utf8' });

test('sync copies shared engine into both plugins without tests', () => {
  const root = sandbox();
  const r = run(root);
  assert.equal(r.status, 0, r.stderr);
  for (const p of ['pre-launch-check', 'post-launch-check']) {
    assert.ok(fs.existsSync(path.join(root, 'plugins', p, 'vendor/launch-checks/lib/a.js')));
    assert.ok(!fs.existsSync(path.join(root, 'plugins', p, 'vendor/launch-checks/test')));
  }
});

test('--check passes after sync and fails after drift', () => {
  const root = sandbox();
  run(root);
  assert.equal(run(root, '--check').status, 0);
  fs.appendFileSync(path.join(root, 'plugins/pre-launch-check/vendor/launch-checks/lib/a.js'), '// drift\n');
  const r = run(root, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /pre-launch-check/);
});

test('--check fails when a plugin has never been synced', () => {
  const root = sandbox();
  assert.equal(run(root, '--check').status, 1);
});
