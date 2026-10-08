import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runChecks, loadRows } from '../lib/engine.js';
import checks from '../checks/index.js';
import { page, site, evidence } from './helpers/ev.js';

const config = { thresholds: { pagespeedMobile: 55, pagespeedDesktop: 85, imageKb: 100, heroImageKb: 200 }, language: 'en', figmaUrl: '' };
const post = { phase: 'post', expectations: { robotsMode: 'allow', metaRobots: 'index, follow' } };
const pre = { phase: 'pre', expectations: { robotsMode: 'block', metaRobots: 'noindex, nofollow' } };

test('every auto row in the catalog has an implemented check', () => {
  const missing = loadRows().filter(r => r.type === 'auto' && !checks[r.id]).map(r => r.id);
  assert.deepEqual(missing, []);
});

test('rows are filtered by phase', () => {
  const ids = (p) => runChecks(evidence(), p, config).map(r => r.id);
  assert.ok(ids(pre).includes('AUTH-001') && !ids(pre).includes('GA-001'));
  assert.ok(ids(post).includes('GA-001') && !ids(post).includes('AUTH-001'));
});

test('row types map to statuses', () => {
  const rows = Object.fromEntries(runChecks(evidence(), post, { ...config, figmaUrl: 'https://figma.com/x' }).map(r => [r.id, r]));
  assert.equal(rows['UI-001'].status, 'manual-todo');
  assert.equal(rows['UI-001'].reason, 'Figma: https://figma.com/x');
  assert.equal(rows['CAP-002'].status, 'manual-todo');
  assert.equal(rows['SEO-003'].status, 'review-needed');
  assert.equal(rows['SEO-003'].reason, 'Awaiting Claude review');
  assert.ok(['pass', 'fail'].includes(rows['SEO-005'].status));
});

test('a throwing check becomes an error row and the run continues', () => {
  const original = checks['SEO-005'];
  checks['SEO-005'] = () => { throw new Error('boom'); };
  try {
    const rows = runChecks(evidence(), post, config);
    const r = rows.find(x => x.id === 'SEO-005');
    assert.equal(r.status, 'error');
    assert.equal(r.reason, 'boom');
    assert.ok(rows.length > 10);
  } finally { checks['SEO-005'] = original; }
});

test('no loadable pages turns every auto row into an error, not a vacuous pass', () => {
  const dead = page({ status: 0, error: 'timeout' });
  const rows = runChecks(evidence([dead], site()), post, config);
  for (const r of rows.filter(x => x.type === 'auto')) {
    assert.equal(r.status, 'error', r.id);
    assert.equal(r.reason, 'No pages could be loaded');
  }
});
