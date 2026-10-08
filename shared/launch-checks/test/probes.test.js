import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFetch, probeHome, probeSite } from '../capture/probes.js';

const resp = (status, { url = '', body = '', headers = {} } = {}) => ({
  status, url, ok: status < 400, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, text: async () => body,
});
const creds = { user: 'u', password: 'p' };

test('makeFetch sends basic auth only to the base origin', async () => {
  const seen = [];
  const f = makeFetch('https://s.test/', creds, async (url, init) => { seen.push([url, init?.headers?.Authorization]); return resp(200); });
  await f('https://s.test/a');
  await f('https://other.test/b');
  assert.equal(seen[0][1], 'Basic ' + Buffer.from('u:p').toString('base64'));
  assert.equal(seen[1][1], undefined);
});

test('makeFetch without credentials adds no header', async () => {
  let h;
  await makeFetch('https://s.test/', null, async (u, init) => { h = init?.headers?.Authorization; return resp(200); })('https://s.test/');
  assert.equal(h, undefined);
});

test('probeHome detects basic auth, noindex and robots disallow', async () => {
  const raw = async (url, init) => {
    const authed = !!init?.headers?.Authorization;
    if (url === 'https://s.test/') return authed ? resp(200, { body: '<meta name="robots" content="noindex, nofollow">' }) : resp(401, { headers: { 'www-authenticate': 'Basic' } });
    if (url.endsWith('/robots.txt')) return resp(200, { body: 'User-agent: *\nDisallow: /' });
    return resp(404);
  };
  assert.deepEqual(await probeHome('https://s.test/', creds, raw), { robotsBlocked: true, metaNoindex: true, basicAuth: true });
});

test('probeHome on an open site reports nothing', async () => {
  const raw = async (url) => url.endsWith('/robots.txt') ? resp(404) : resp(200, { body: '<html></html>' });
  assert.deepEqual(await probeHome('https://s.test/', null, raw), { robotsBlocked: false, metaNoindex: false, basicAuth: false });
});

test('probeSite collects robots, redirects, 404 and basic auth', async () => {
  const raw = async (url, init) => {
    if (url === 'http://s.test/') return resp(200, { url: 'https://s.test/' });
    if (url === 'http://www.s.test/') throw new Error('ENOTFOUND');
    if (url.endsWith('/robots.txt')) return resp(200, { body: 'User-agent: *\nDisallow:' });
    if (url.includes('__launch-check-404')) return resp(404);
    return resp(200);
  };
  const s = await probeSite('https://s.test/', null, raw);
  assert.equal(s.expectedHost, 's.test');
  assert.deepEqual(s.robots, { status: 200, body: 'User-agent: *\nDisallow:' });
  assert.equal(s.redirects.http.finalUrl, 'https://s.test/');
  assert.equal(s.redirects.wwwHttp.error, 'ENOTFOUND');
  assert.equal(s.notFound.status, 404);
  assert.equal(s.basicAuth.challenged, false);
});
