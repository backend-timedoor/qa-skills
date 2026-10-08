import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLinks } from '../capture/links.js';

const res = (status) => ({ status });

const O = 'https://a.test';
const opts = { baseOrigin: O, retryDelayMs: 0 };
const netErr = (code) => Object.assign(new TypeError('fetch failed'), { cause: { code } });

test('reports 4xx and network failures, with the pages they were found on', async () => {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push(`${init.method} ${url}`);
    if (url.endsWith('/gone')) return res(404);
    if (url.endsWith('/boom')) throw netErr('ECONNRESET');
    return res(200);
  };
  const map = new Map([
    ['https://a.test/ok', ['https://a.test/']],
    ['https://a.test/gone', ['https://a.test/', 'https://a.test/p']],
    ['https://a.test/boom', ['https://a.test/p']],
    ['mailto:x@y.z', ['https://a.test/']],
  ]);
  const { broken, unverified } = await checkLinks(map, fetchFn, opts);
  assert.deepEqual(broken.map(b => [b.url, b.status]).sort(), [['https://a.test/boom', 0], ['https://a.test/gone', 404]]);
  assert.equal(broken.find(b => b.url.endsWith('/boom')).error, 'ECONNRESET');
  assert.deepEqual(broken.find(b => b.url.endsWith('/gone')).from, ['https://a.test/', 'https://a.test/p']);
  assert.deepEqual(unverified, []);
  assert.ok(!calls.some(c => c.includes('mailto')));
});

test('a transient error is retried once with GET and not reported', async () => {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push(init.method);
    if (calls.length === 1) throw netErr('ETIMEDOUT');
    return res(200);
  };
  const r = await checkLinks(new Map([['https://a.test/x', ['p']]]), fetchFn, opts);
  assert.deepEqual(r, { broken: [], unverified: [] });
  assert.deepEqual(calls, ['HEAD', 'GET']);
});

test('a persistent network error is broken on an internal URL and unverified on an external one', async () => {
  const fetchFn = async () => { throw netErr('ETIMEDOUT'); };
  const r = await checkLinks(new Map([['https://a.test/x', ['p']], ['https://wa.me/1', ['p']]]), fetchFn, opts);
  assert.deepEqual(r.broken.map(b => [b.url, b.status, b.error]), [['https://a.test/x', 0, 'ETIMEDOUT']]);
  assert.deepEqual(r.unverified.map(b => [b.url, b.status, b.error]), [['https://wa.me/1', 0, 'ETIMEDOUT']]);
});

test('external 404 is broken, external 403 is unverified, internal 403 is broken', async () => {
  const fetchFn = async (url) => res(url.endsWith('/nf') ? 404 : 403);
  const map = new Map([['https://ext.test/nf', ['p']], ['https://ext.test/bot', ['p']], ['https://a.test/priv', ['p']]]);
  const r = await checkLinks(map, fetchFn, opts);
  assert.deepEqual(r.broken.map(b => b.url).sort(), ['https://a.test/priv', 'https://ext.test/nf']);
  assert.deepEqual(r.unverified.map(b => b.url), ['https://ext.test/bot']);
});

test('5xx is retried with GET, then classified', async () => {
  const calls = [];
  const fetchFn = async (url, init) => { calls.push(`${init.method} ${url}`); return res(url.includes('flaky') ? (init.method === 'HEAD' ? 503 : 200) : 502); };
  const map = new Map([['https://a.test/flaky', ['p']], ['https://a.test/down', ['p']], ['https://ext.test/down', ['p']]]);
  const r = await checkLinks(map, fetchFn, opts);
  assert.deepEqual(r.broken.map(b => [b.url, b.status]), [['https://a.test/down', 502]]);
  assert.deepEqual(r.unverified.map(b => [b.url, b.status]), [['https://ext.test/down', 502]]);
  assert.ok(calls.includes('GET https://a.test/flaky'));
});

test('retries with GET when HEAD is rejected', async () => {
  const fetchFn = async (url, init) => res(init.method === 'HEAD' ? 405 : 200);
  assert.deepEqual(await checkLinks(new Map([['https://a.test/x', ['p']]]), fetchFn, opts), { broken: [], unverified: [] });
});

test('respects the cap', async () => {
  let n = 0;
  const fetchFn = async () => { n++; return res(200); };
  const map = new Map(Array.from({ length: 10 }, (_, i) => [`https://a.test/${i}`, ['p']]));
  await checkLinks(map, fetchFn, { cap: 4 });
  assert.equal(n, 4);
});

test('buildLinkMap strips fragments, merges from-lists and keeps only http(s)', async () => {
  const { buildLinkMap } = await import('../capture/links.js');
  const map = buildLinkMap([
    { url: 'https://a.test/', links: [{ href: 'https://a.test/x#a' }, { href: 'https://a.test/x#b' }, { href: 'mailto:x@y.z' }, { href: 'not a url' }] },
    { url: 'https://a.test/p', links: [{ href: 'https://a.test/x' }] },
  ]);
  assert.deepEqual([...map], [['https://a.test/x', ['https://a.test/', 'https://a.test/', 'https://a.test/p']]]);
});
