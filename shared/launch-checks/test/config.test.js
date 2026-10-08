import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, loadPhase } from '../lib/config.js';
import { robotsBlocksAll } from '../lib/robots.js';

const tmp = (name, obj) => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lc-cfg-')), name);
  fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return f;
};

test('loadConfig applies defaults and merges thresholds', () => {
  const c = loadConfig(tmp('c.json', { baseUrl: 'https://a.test', thresholds: { pagespeedMobile: 70 } }));
  assert.equal(c.pageCap, 30);
  assert.equal(c.thresholds.pagespeedMobile, 70);
  assert.equal(c.thresholds.pagespeedDesktop, 85);
});

test('loadConfig rejects missing or invalid baseUrl', () => {
  assert.throws(() => loadConfig(tmp('c.json', {})), /baseUrl is required/);
  assert.throws(() => loadConfig(tmp('c.json', { baseUrl: 'not a url' })), /baseUrl is not a valid URL/);
});

test('loadPhase validates phase', () => {
  assert.equal(loadPhase(tmp('p.json', { phase: 'pre', expectations: { robotsMode: 'block', metaRobots: 'noindex, nofollow' } })).phase, 'pre');
  assert.throws(() => loadPhase(tmp('p.json', { phase: 'mid', expectations: {} })), /phase must be/);
});

test('robotsBlocksAll detects Disallow: / for all agents only', () => {
  assert.equal(robotsBlocksAll('User-agent: *\nDisallow: /'), true);
  assert.equal(robotsBlocksAll('User-agent: *\nDisallow: /admin'), false);
  assert.equal(robotsBlocksAll('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow:'), false);
  assert.equal(robotsBlocksAll(''), false);
});
