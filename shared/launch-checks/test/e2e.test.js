import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './helpers/server.js';

const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'cli.js');
const PHASES = {
  pre: { phase: 'pre', expectations: { robotsMode: 'block', metaRobots: 'noindex, nofollow' } },
  post: { phase: 'post', expectations: { robotsMode: 'allow', metaRobots: 'index, follow' } },
};

function project(baseUrl, phase, env = '') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-e2e-'));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ baseUrl, pageCap: 5, timeoutMs: 10000 }));
  fs.writeFileSync(path.join(dir, 'phase.json'), JSON.stringify(PHASES[phase]));
  if (env) fs.writeFileSync(path.join(dir, '.env'), env);
  return dir;
}
// Async spawn: the fixture server lives in this process, so a blocking spawnSync would starve it.
const cliRun = (dir, args) => new Promise((resolve) => {
  const child = spawn('node', [cli, ...args], { cwd: dir });
  let stdout = '', stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  child.on('close', (status) => resolve({ status, stdout, stderr }));
});
const rows = (dir, out) => Object.fromEntries(JSON.parse(fs.readFileSync(path.join(dir, out, 'report.json'), 'utf8')).rows.map(r => [r.id, r]));

test('pre-launch run against a staging fixture with basic auth', async () => {
  const auth = { user: 'qa', password: 's3cret-pass' };
  const s = await startServer('pre', { auth });
  try {
    const dir = project(s.url, 'pre', `BASIC_AUTH_USER=${auth.user}\nBASIC_AUTH_PASSWORD=${auth.password}\n`);
    const r = await cliRun(dir, ['run', '--config', 'config.json', '--phase', 'phase.json', '--out', 'out']);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const by = rows(dir, 'out');
    assert.equal(by['AUTH-001'].status, 'pass');
    assert.equal(by['CRAWL-001'].status, 'pass');
    assert.equal(by['CRAWL-002'].status, 'pass');
    assert.equal(by['SEO-005'].status, 'pass');
    assert.equal(by['SEO-006'].status, 'pass');
    assert.equal(by['LINK-002'].status, 'pass');
    assert.equal(by['LINK-001'].status, 'fail');
    assert.equal(by['UI-001'].status, 'manual-todo');
    assert.equal(by['SEO-003'].status, 'review-needed');
    for (const f of ['evidence.json', 'report.json', 'report.md']) {
      assert.ok(!fs.readFileSync(path.join(dir, 'out', f), 'utf8').includes(auth.password), `${f} leaks the password`);
    }
  } finally { await s.close(); }
});

test('a pre-launch run against an open site stops with exit code 2 unless --yes is given', async () => {
  const s = await startServer('post');
  try {
    const dir = project(s.url, 'pre');
    const r = await cliRun(dir, ['run', '--config', 'config.json', '--phase', 'phase.json', '--out', 'out']);
    assert.equal(r.status, 2);
    assert.match(r.stderr + r.stdout, /looks live/i);
    assert.ok(!fs.existsSync(path.join(dir, 'out')));
    const again = await cliRun(dir, ['run', '--config', 'config.json', '--phase', 'phase.json', '--out', 'out', '--yes']);
    assert.equal(again.status, 0, again.stderr);
    assert.equal(rows(dir, 'out')['CRAWL-001'].status, 'fail');
  } finally { await s.close(); }
});

test('merge-review and render update the report', async () => {
  const s = await startServer('post');
  try {
    const dir = project(s.url, 'post');
    assert.equal((await cliRun(dir, ['run', '--config', 'config.json', '--phase', 'phase.json', '--out', 'out'])).status, 0);
    fs.writeFileSync(path.join(dir, 'out', 'review.json'), JSON.stringify([{ id: 'SEO-003', status: 'pass', reason: 'Matches format' }]));
    assert.equal((await cliRun(dir, ['merge-review', 'out'])).status, 0);
    assert.equal(rows(dir, 'out')['SEO-003'].status, 'pass');
    assert.match(fs.readFileSync(path.join(dir, 'out', 'report.md'), 'utf8'), /SEO-003 \| .* \| pass/);
  } finally { await s.close(); }
});

test('an unreachable site exits 1 with a clear message, even with --yes', async () => {
  const dir = project('http://127.0.0.1:1/', 'post');
  const r = await cliRun(dir, ['run', '--config', 'config.json', '--phase', 'phase.json', '--out', 'out', '--yes']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Cannot reach http:\/\/127\.0\.0\.1:1\//);
});

test('bad config prints a clear error and exits 1', async () => {
  const dir = project('not a url', 'post');
  const r = await cliRun(dir, ['run', '--config', 'config.json', '--phase', 'phase.json', '--out', 'out']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /baseUrl is not a valid URL/);
});
