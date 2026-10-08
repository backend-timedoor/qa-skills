import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLinks } from '../capture/links.js';

const res = (status) => ({ status });

test('reports 4xx/5xx and network failures, with the pages they were found on', async () => {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push(`${init.method} ${url}`);
    if (url.endsWith('/gone')) return res(404);
    if (url.endsWith('/boom')) throw new Error('ECONNRESET');
    return res(200);
  };
  const map = new Map([
    ['https://a.test/ok', ['https://a.test/']],
    ['https://a.test/gone', ['https://a.test/', 'https://a.test/p']],
    ['https://a.test/boom', ['https://a.test/p']],
    ['mailto:x@y.z', ['https://a.test/']],
  ]);
  const broken = await checkLinks(map, fetchFn);
  assert.deepEqual(broken.map(b => [b.url, b.status]).sort(), [['https://a.test/boom', 0], ['https://a.test/gone', 404]]);
  assert.deepEqual(broken.find(b => b.url.endsWith('/gone')).from, ['https://a.test/', 'https://a.test/p']);
  assert.ok(!calls.some(c => c.includes('mailto')));
});

test('retries with GET when HEAD is rejected', async () => {
  const fetchFn = async (url, init) => res(init.method === 'HEAD' ? 405 : 200);
  assert.deepEqual(await checkLinks(new Map([['https://a.test/x', ['p']]]), fetchFn), []);
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
