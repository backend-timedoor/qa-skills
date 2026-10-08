import { test } from 'node:test';
import assert from 'node:assert/strict';
import images from '../checks/images.js';
import content from '../checks/content.js';
import { page, evidence, ctx } from './helpers/ev.js';

const img = (o = {}) => ({ src: 'https://x.test/a.jpg', alt: 'a', loading: null, bytes: 50_000, width: 300, height: 200, naturalWidth: 600, naturalHeight: 400, inViewport: true, ...o });
const run = (mod, id, pages, c = ctx()) => mod[id](evidence(pages), c);

test('SEO-012 flags images with no alt attribute but accepts empty alt', () => {
  assert.equal(run(images, 'SEO-012', [page({ images: [img({ alt: '' }), img()] })]).status, 'pass');
  const r = run(images, 'SEO-012', [page({ images: [img({ alt: null })] })]);
  assert.equal(r.status, 'fail');
  assert.deepEqual(r.pages, ['https://x.test/']);
});

test('IMG-001 uses 100KB for normal and 200KB for wide images, skipping unknown sizes', () => {
  const kb = (n) => n * 1024;
  assert.equal(run(images, 'IMG-001', [page({ images: [img({ bytes: kb(90) })] })]).status, 'pass');
  assert.equal(run(images, 'IMG-001', [page({ images: [img({ bytes: kb(150) })] })]).status, 'fail');
  assert.equal(run(images, 'IMG-001', [page({ images: [img({ bytes: kb(150), width: 1400 })] })]).status, 'pass');
  assert.equal(run(images, 'IMG-001', [page({ images: [img({ bytes: kb(250), width: 1400 })] })]).status, 'fail');
  assert.equal(run(images, 'IMG-001', [page({ images: [img({ bytes: null })] })]).status, 'pass');
});

test('IMG-001 counts distinct images and names the heaviest', () => {
  const kb = (n) => n * 1024;
  const pages = [
    page({ url: 'https://x.test/a', images: [img({ src: 'https://x.test/up/big.jpg', bytes: kb(300) }), img({ src: 'https://x.test/up/mid.jpg', bytes: kb(150) })] }),
    page({ url: 'https://x.test/b', images: [img({ src: 'https://x.test/up/big.jpg', bytes: kb(300) })] }),
  ];
  const r = run(images, 'IMG-001', pages);
  assert.equal(r.status, 'fail');
  assert.match(r.reason, /^2 distinct image\(s\) over the size limit \(3 occurrence\(s\)\); heaviest: big\.jpg 300KB on https:\/\/x\.test\/a, mid\.jpg 150KB on https:\/\/x\.test\/a$/);
  assert.deepEqual(r.pages, ['https://x.test/a', 'https://x.test/b']);
});

test('IMG-001 honours custom thresholds', () => {
  const c = ctx({ thresholds: { imageKb: 50, heroImageKb: 200, pagespeedMobile: 55, pagespeedDesktop: 85 } });
  assert.equal(run(images, 'IMG-001', [page({ images: [img({ bytes: 60 * 1024 })] })], c).status, 'fail');
});

test('IMG-002 images below the fold need loading=lazy', () => {
  assert.equal(run(images, 'IMG-002', [page({ images: [img({ inViewport: false, loading: 'lazy' }), img({ inViewport: true })] })]).status, 'pass');
  assert.equal(run(images, 'IMG-002', [page({ images: [img({ inViewport: false, loading: null })] })]).status, 'fail');
  assert.equal(run(images, 'IMG-002', [page()]).status, 'pass');
});

test('UI-008 detects lorem ipsum', () => {
  assert.equal(run(content, 'UI-008', [page({ bodyText: 'Real text here' })]).status, 'pass');
  assert.equal(run(content, 'UI-008', [page({ bodyText: 'Lorem ipsum dolor sit amet' })]).status, 'fail');
});

test('UI-019 accepts MM/DD/YYYY and Month D, YYYY, rejects other formats', () => {
  const body = (t) => [page({ bodyText: t })];
  assert.equal(run(content, 'UI-019', body('Posted 02/14/2025')).status, 'pass');
  assert.equal(run(content, 'UI-019', body('Posted February 14, 2025')).status, 'pass');
  assert.equal(run(content, 'UI-019', body('Posted 14/02/2025')).status, 'fail');
  assert.equal(run(content, 'UI-019', body('Posted 14 February 2025')).status, 'fail');
  assert.equal(run(content, 'UI-019', body('Posted 2025-02-14')).status, 'fail');
  assert.equal(run(content, 'UI-019', body('No dates here')).status, 'pass');
  assert.equal(run(content, 'UI-019', body('14/02/2025'), ctx({ language: 'id' })).status, 'n/a');
});
