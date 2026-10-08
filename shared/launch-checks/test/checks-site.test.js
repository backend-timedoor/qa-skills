import { test } from 'node:test';
import assert from 'node:assert/strict';
import site from '../checks/site.js';
import { page, site as mkSite, evidence, ctx } from './helpers/ev.js';

const pre = ctx({ expectations: { robotsMode: 'block', metaRobots: 'noindex, nofollow' } });
const post = ctx();
const run = (id, s = {}, c = post, pages = [page()]) => site[id](evidence(pages, mkSite(s)), c);
const robotsMeta = (c) => page({ metas: [{ name: 'robots', property: null, content: c }] });

test('AUTH-001 / GA-001 / CAP-001 read site evidence', () => {
  assert.equal(run('AUTH-001', { basicAuth: { challenged: true } }).status, 'pass');
  assert.equal(run('AUTH-001').status, 'fail');
  assert.equal(run('GA-001', { scripts: { ga: true, captcha: false } }).status, 'pass');
  assert.equal(run('GA-001').status, 'fail');
  assert.equal(run('CAP-001', { scripts: { ga: false, captcha: true } }).status, 'pass');
  assert.equal(run('CAP-001').status, 'fail');
});

test('CRAWL-001 robots.txt follows the phase', () => {
  const blocked = { robots: { status: 200, body: 'User-agent: *\nDisallow: /' } };
  const open = { robots: { status: 200, body: 'User-agent: *\nDisallow:' } };
  const missing = { robots: { status: 404, body: '' } };
  assert.equal(run('CRAWL-001', blocked, pre).status, 'pass');
  assert.equal(run('CRAWL-001', open, pre).status, 'fail');
  assert.equal(run('CRAWL-001', missing, pre).status, 'fail');
  assert.equal(run('CRAWL-001', open, post).status, 'pass');
  assert.equal(run('CRAWL-001', missing, post).status, 'pass');
  assert.equal(run('CRAWL-001', blocked, post).status, 'fail');
});

test('CRAWL-002 meta robots follows the phase; absent tag means index, follow', () => {
  assert.equal(run('CRAWL-002', {}, pre, [robotsMeta('NOINDEX, nofollow')]).status, 'pass');
  assert.equal(run('CRAWL-002', {}, pre, [page()]).status, 'fail');
  assert.equal(run('CRAWL-002', {}, pre, [robotsMeta('noindex')]).status, 'fail');
  assert.equal(run('CRAWL-002', {}, post, [page()]).status, 'pass');
  assert.equal(run('CRAWL-002', {}, post, [robotsMeta('index, follow')]).status, 'pass');
  const r = run('CRAWL-002', {}, post, [robotsMeta('noindex, nofollow')]);
  assert.equal(r.status, 'fail');
  assert.deepEqual(r.pages, ['https://x.test/']);
});

test('CRAWL-002 is token based for real-world values', () => {
  for (const v of ['max-image-preview:large', 'index, follow, max-image-preview:large, max-snippet:-1', 'all', 'INDEX,FOLLOW'])
    assert.equal(run('CRAWL-002', {}, post, [robotsMeta(v)]).status, 'pass', v);
  for (const v of ['noindex', 'nofollow', 'none', 'noindex, nofollow, max-image-preview:large'])
    assert.equal(run('CRAWL-002', {}, post, [robotsMeta(v)]).status, 'fail', v);
  for (const v of ['noindex, nofollow, max-image-preview:large', 'none', 'NoIndex , NoFollow'])
    assert.equal(run('CRAWL-002', {}, pre, [robotsMeta(v)]).status, 'pass', v);
  for (const v of ['nofollow', 'index, follow', 'all'])
    assert.equal(run('CRAWL-002', {}, pre, [robotsMeta(v)]).status, 'fail', v);
  const both = page({ metas: [{ name: 'robots', property: null, content: 'index, follow' }, { name: 'googlebot', property: null, content: 'noindex' }] });
  assert.equal(run('CRAWL-002', {}, post, [both]).status, 'fail');
  assert.match(run('CRAWL-002', {}, post, [robotsMeta('noindex')]).reason, /noindex/);
});

test('LINK-001 / LINK-002', () => {
  assert.equal(run('LINK-001').status, 'pass');
  const r = run('LINK-001', { brokenLinks: [{ url: 'https://x.test/gone', status: 404, from: ['https://x.test/'] }] });
  assert.equal(r.status, 'fail');
  assert.deepEqual(r.pages, ['https://x.test/']);
  assert.equal(run('LINK-002').status, 'pass');
  assert.equal(run('LINK-002', { notFound: { status: 200 } }).status, 'fail');
});

test('HTTPS-001 / HTTPS-002', () => {
  assert.equal(run('HTTPS-001').status, 'pass');
  assert.equal(run('HTTPS-001', { redirects: { http: { finalUrl: 'http://x.test/' }, wwwHttp: { finalUrl: 'https://x.test/' } } }).status, 'fail');
  assert.equal(run('HTTPS-001', { redirects: { http: { error: 'ECONNREFUSED' }, wwwHttp: {} } }).status, 'fail');
  assert.equal(run('HTTPS-002').status, 'pass');
  assert.equal(run('HTTPS-002', { redirects: { http: {}, wwwHttp: { finalUrl: 'https://www.x.test/' } } }).status, 'fail');
  assert.equal(run('HTTPS-002', { redirects: { http: {}, wwwHttp: { error: 'ENOTFOUND' } } }).status, 'review-needed');
});

test('PERF-001 compares scores to thresholds and degrades to review-needed', () => {
  assert.equal(run('PERF-001').status, 'pass');
  assert.equal(run('PERF-001', { pagespeed: { mobile: 40, desktop: 90, error: null } }).status, 'fail');
  assert.equal(run('PERF-001', { pagespeed: { mobile: 80, desktop: 70, error: null } }).status, 'fail');
  const r = run('PERF-001', { pagespeed: { mobile: null, desktop: null, error: 'HTTP 429' } });
  assert.equal(r.status, 'review-needed');
  assert.match(r.reason, /pagespeed\.web\.dev/);
});
