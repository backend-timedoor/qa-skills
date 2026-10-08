import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, renderMarkdown, mergeReview } from '../lib/report.js';

const row = (o) => ({ id: 'SEO-001', group: 'SEO Standard', check: 'c', type: 'auto', steps: 's', expected: 'e', status: 'pass', reason: '', pages: [], ...o });
const rows = [
  row({}),
  row({ id: 'SEO-005', status: 'fail', reason: '2 page(s) without an H1', pages: ['https://x.test/a'] }),
  row({ id: 'SEO-003', type: 'review', status: 'review-needed', reason: 'Awaiting Claude review' }),
  row({ id: 'UI-001', group: 'UI/UX', type: 'manual', status: 'manual-todo', reason: '' }),
];
const base = () => buildReport({ site: 'https://x.test', phase: 'post', runDate: '2026-10-08', rows: structuredClone(rows) });

test('buildReport counts statuses', () => {
  const r = base();
  assert.deepEqual(r.summary, { pass: 1, fail: 1, 'review-needed': 1, 'manual-todo': 1, 'n/a': 0, error: 0 });
});

test('renderMarkdown groups rows, lists failures and escapes pipes', () => {
  const r = base();
  r.rows[0].reason = 'a | b\nc';
  const md = renderMarkdown(r);
  assert.match(md, /^# Launch check: post-launch/m);
  assert.match(md, /https:\/\/x\.test/);
  assert.match(md, /## Failures[\s\S]*SEO-005/);
  assert.match(md, /## SEO Standard/);
  assert.match(md, /## UI\/UX/);
  assert.match(md, /a \\\| b c/);
});

test('mergeReview applies pass/fail, keeps unsure as review-needed, ignores non-review rows', () => {
  const merged = mergeReview(base(), [
    { id: 'SEO-003', status: 'pass', reason: 'Title matches format' },
    { id: 'UI-001', status: 'pass', reason: 'should be ignored' },
    { id: 'NOPE-1', status: 'fail', reason: 'unknown' },
  ]);
  const by = Object.fromEntries(merged.rows.map(r => [r.id, r]));
  assert.equal(by['SEO-003'].status, 'pass');
  assert.equal(by['SEO-003'].reason, 'Title matches format');
  assert.equal(by['UI-001'].status, 'manual-todo');
  assert.deepEqual(merged.ignoredReview.sort(), ['NOPE-1', 'UI-001']);
  assert.equal(merged.summary.pass, 2);

  const unsure = mergeReview(base(), [{ id: 'SEO-003', status: 'unsure', reason: 'Needs a form submit' }]);
  const r = unsure.rows.find(x => x.id === 'SEO-003');
  assert.equal(r.status, 'review-needed');
  assert.equal(r.reason, 'Needs a form submit');
});
