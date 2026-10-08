import { test } from 'node:test';
import assert from 'node:assert/strict';
import meta from '../checks/meta.js';
import headings from '../checks/headings.js';
import footer from '../checks/footer.js';
import { page, evidence, ctx } from './helpers/ev.js';

const m = (name, content) => ({ name, property: null, content });
const og = (property, content) => ({ name: null, property, content });
const run = (mod, id, pages) => mod[id](evidence(pages), ctx());

test('SEO-001 flags pages missing title or description', () => {
  const good = page({ metas: [m('description', 'd')] });
  const noDesc = page({ url: 'https://x.test/a', isHome: false });
  const noTitle = page({ url: 'https://x.test/b', isHome: false, title: '', metas: [m('description', 'd')] });
  assert.equal(run(meta, 'SEO-001', [good]).status, 'pass');
  const r = run(meta, 'SEO-001', [good, noDesc, noTitle]);
  assert.equal(r.status, 'fail');
  assert.deepEqual(r.pages, ['https://x.test/a', 'https://x.test/b']);
});

test('SEO-001 ignores pages that failed to load', () => {
  const dead = page({ url: 'https://x.test/dead', status: 0, error: 'timeout', title: '' });
  assert.equal(run(meta, 'SEO-001', [page({ metas: [m('description', 'd')] }), dead]).status, 'pass');
});

test('SEO-002 needs 2-5 keywords on the homepage', () => {
  assert.equal(run(meta, 'SEO-002', [page({ metas: [m('keywords', 'a, b, c')] })]).status, 'pass');
  assert.equal(run(meta, 'SEO-002', [page({ metas: [m('keywords', 'a')] })]).status, 'fail');
  assert.equal(run(meta, 'SEO-002', [page({ metas: [m('keywords', 'a,b,c,d,e,f')] })]).status, 'fail');
  assert.equal(run(meta, 'SEO-002', [page()]).status, 'fail');
  assert.equal(run(meta, 'SEO-002', [page({ isHome: false })]).status, 'n/a');
});

test('SEO-017 requires the four OG tags', () => {
  const full = page({ metas: [og('og:title', 't'), og('og:type', 'website'), og('og:image', 'i'), og('og:url', 'u')] });
  assert.equal(run(meta, 'SEO-017', [full]).status, 'pass');
  const missing = page({ url: 'https://x.test/a', isHome: false, metas: [og('og:title', 't'), og('og:url', 'u')] });
  const r = run(meta, 'SEO-017', [full, missing]);
  assert.equal(r.status, 'fail');
  assert.match(r.reason, /og:type|og:image|missing/i);
});

test('SEO-018 flags duplicated meta tags', () => {
  const dup = page({ metas: [m('description', 'a'), m('description', 'b'), og('og:title', 't')] });
  assert.equal(run(meta, 'SEO-018', [dup]).status, 'fail');
  assert.equal(run(meta, 'SEO-018', [page({ metas: [m('description', 'a')] })]).status, 'pass');
});

test('SEO-005/007 H1 present and single', () => {
  const none = page({ headings: [{ level: 2, text: 'x' }] });
  const two = page({ headings: [{ level: 1, text: 'a' }, { level: 1, text: 'b' }] });
  assert.equal(run(headings, 'SEO-005', [none]).status, 'fail');
  assert.equal(run(headings, 'SEO-005', [page()]).status, 'pass');
  assert.equal(run(headings, 'SEO-007', [two]).status, 'fail');
  assert.equal(run(headings, 'SEO-007', [page()]).status, 'pass');
});

test('SEO-006 H1 text must be unique across pages (case/space insensitive)', () => {
  const a = page({ url: 'https://x.test/a', headings: [{ level: 1, text: 'About  Us' }] });
  const b = page({ url: 'https://x.test/b', headings: [{ level: 1, text: 'about us' }] });
  const c = page({ url: 'https://x.test/c', headings: [{ level: 1, text: 'Contact' }] });
  const r = run(headings, 'SEO-006', [a, b, c]);
  assert.equal(r.status, 'fail');
  assert.deepEqual(r.pages.sort(), ['https://x.test/a', 'https://x.test/b']);
  assert.equal(run(headings, 'SEO-006', [a, c]).status, 'pass');
});

test('SEO-009 heading order: no skipped levels, no h1 after the first heading', () => {
  const h = (...levels) => page({ headings: levels.map(level => ({ level, text: 't' })) });
  assert.equal(run(headings, 'SEO-009', [h(1, 2, 3, 2, 3)]).status, 'pass');
  assert.equal(run(headings, 'SEO-009', [h(1, 3)]).status, 'fail');
  assert.equal(run(headings, 'SEO-009', [h(1, 2, 3, 1)]).status, 'fail');
  assert.equal(run(headings, 'SEO-009', [h(2, 1)]).status, 'fail');
});

const credit = (o = {}) => ({
  text: 'Copyright 2026 Acme. Powered by PT Timedoor Indonesia. All Rights Reserved.',
  creditLink: { href: 'https://timedoor.net/', target: '_blank', color: 'rgb(51, 51, 51)' },
  textColor: 'rgb(51, 51, 51)', ...o,
});

test('SEO-015 home footer credit rules', () => {
  assert.equal(run(footer, 'SEO-015', [page({ footer: credit() })]).status, 'pass');
  assert.equal(run(footer, 'SEO-015', [page({ footer: null })]).status, 'fail');
  assert.equal(run(footer, 'SEO-015', [page({ footer: credit({ text: 'Copyright Acme' }) })]).status, 'fail');
  const noBlank = credit(); noBlank.creditLink.target = '_self';
  assert.equal(run(footer, 'SEO-015', [page({ footer: noBlank })]).status, 'fail');
  const colored = credit(); colored.creditLink.color = 'rgb(0, 0, 238)';
  assert.equal(run(footer, 'SEO-015', [page({ footer: colored })]).status, 'fail');
  const wrongHref = credit(); wrongHref.creditLink.href = 'https://example.com/';
  assert.equal(run(footer, 'SEO-015', [page({ footer: wrongHref })]).status, 'fail');
});

test('SEO-016 inner pages must not carry the credit', () => {
  const inner = page({ url: 'https://x.test/a', isHome: false, footer: credit() });
  assert.equal(run(footer, 'SEO-016', [inner]).status, 'fail');
  assert.equal(run(footer, 'SEO-016', [page({ url: 'https://x.test/a', isHome: false, footer: credit({ text: 'Copyright Acme' }) })]).status, 'pass');
});
