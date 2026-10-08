import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { extractPage, emptyPage } from '../capture/extract.js';

const require = createRequire(import.meta.url);
let browser;
before(async () => { browser = await require('playwright').chromium.launch(); });
after(async () => { await browser?.close(); });

const HTML = `<!doctype html><html><head><title>Hi</title>
<meta name="description" content="d"><meta property="og:title" content="t">
<link rel="icon" href="/favicon.ico">
<script src="https://www.google.com/recaptcha/api.js"></script>
<script>window.dataLayer=[];function gtag(){}; gtag('config','G-1');</script></head>
<body><nav class="breadcrumb">Home &gt; About</nav><h1>Title</h1><h2>Sub</h2>
<a href="/about">About</a>
<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="dot">
<div style="height:3000px"></div>
<img loading="lazy" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
<form><input type="email" name="email" required></form>
<iframe src="https://www.google.com/maps/embed?pb=1"></iframe>
<footer><p style="color: rgb(10, 20, 30)">Powered by <a style="color: rgb(10, 20, 30)" href="https://timedoor.net/" target="_blank">PT Timedoor Indonesia</a></p></footer>
</body></html>`;

test('extractPage returns structured evidence', async () => {
  const context = await browser.newContext();
  await context.route('**/*', (route) => route.request().url() === 'http://a.test/'
    ? route.fulfill({ status: 200, contentType: 'text/html', body: HTML })
    : route.abort());
  const page = await context.newPage();
  await page.goto('http://a.test/', { waitUntil: 'load' });
  const d = await extractPage(page);
  assert.equal(d.title, 'Hi');
  assert.ok(d.metas.some(m => m.name === 'description' && m.content === 'd'));
  assert.ok(d.metas.some(m => m.property === 'og:title'));
  assert.deepEqual(d.headings.map(h => h.level), [1, 2]);
  assert.equal(d.images.length, 2);
  assert.equal(d.images[0].alt, 'dot');
  assert.equal(d.images[0].inViewport, true);
  assert.equal(d.images[1].alt, null);
  assert.equal(d.images[1].inViewport, false);
  assert.equal(d.images[1].loading, 'lazy');
  assert.equal(d.scripts.captcha, true);
  assert.equal(d.scripts.ga, true);
  assert.equal(d.favicon.endsWith('/favicon.ico'), true);
  assert.match(d.breadcrumb, /Home/);
  assert.equal(d.mapEmbeds, 1);
  assert.equal(d.forms[0].fields[0].required, true);
  assert.equal(d.footer.creditLink.target, '_blank');
  assert.equal(d.footer.creditLink.color, d.footer.textColor);
  assert.match(d.footer.text, /Powered by PT Timedoor Indonesia/);
  assert.ok(d.links.some(l => l.href.endsWith('/about')));
  await context.close();
});

test('emptyPage builds a failed page record that checks can ignore', () => {
  const p = emptyPage('https://a.test/x', 'timeout');
  assert.equal(p.error, 'timeout');
  assert.equal(p.status, 0);
  assert.deepEqual(p.headings, []);
});

const GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const IMG_HTML = `<!doctype html><html><head><title>Imgs</title></head><body>
<img src="${GIF}" alt="real">
<img src="" alt="empty">
<img alt="nosrc">
<img src="/p/#top" alt="self">
<img src="/p/" alt="selfslash">
<img data-src="/lazy.jpg" alt="lazy" style="width:0;height:0">
<img src="${GIF}" alt="cover" style="object-fit:cover">
</body></html>`;

test('extractPage drops phantom images, keeps lazy data-src ones, reports objectFit', async () => {
  const context = await browser.newContext();
  await context.route('**/*', (route) => route.request().url().startsWith('http://a.test/p/')
    ? route.fulfill({ status: 200, contentType: 'text/html', body: IMG_HTML })
    : route.abort());
  const page = await context.newPage();
  await page.goto('http://a.test/p/#frag', { waitUntil: 'load' });
  const d = await extractPage(page);
  assert.deepEqual(d.images.map(i => i.alt), ['real', 'lazy', 'cover']);
  assert.equal(d.images[0].objectFit, 'fill');
  assert.equal(d.images[2].objectFit, 'cover');
  await context.close();
});
