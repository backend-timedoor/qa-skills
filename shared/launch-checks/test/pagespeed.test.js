import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPagespeed } from '../capture/pagespeed.js';

test('returns the performance score as 0-100', async () => {
  let called;
  const fetchFn = async (url) => { called = url; return { ok: true, status: 200, json: async () => ({ lighthouseResult: { categories: { performance: { score: 0.87 } } } }) }; };
  const r = await fetchPagespeed('https://a.test/', 'mobile', 'KEY', fetchFn);
  assert.deepEqual(r, { score: 87, error: null });
  assert.match(called, /strategy=mobile/);
  assert.match(called, /key=KEY/);
  assert.match(called, /url=https%3A%2F%2Fa\.test%2F/);
});

test('reports HTTP errors and thrown errors instead of throwing', async () => {
  assert.deepEqual(await fetchPagespeed('https://a.test/', 'desktop', '', async () => ({ ok: false, status: 429, json: async () => ({}) })), { score: null, error: 'HTTP 429' });
  assert.deepEqual(await fetchPagespeed('https://a.test/', 'desktop', '', async () => { throw new Error('offline'); }), { score: null, error: 'offline' });
});
