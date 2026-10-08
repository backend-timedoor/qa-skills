import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crawl } from '../capture/crawler.js';

const sitemap = (...urls) => `<urlset>${urls.map(u => `<url><loc>${u}</loc></url>`).join('')}</urlset>`;
const visitor = (graph, seen = []) => async (url) => {
  seen.push(url);
  return { url, links: (graph[url] || []).map(href => ({ href, text: '' })) };
};

test('uses sitemap URLs from the same origin, once each, up to the cap', async () => {
  const seen = [];
  const pages = await crawl({
    baseUrl: 'https://s.test/', pageCap: 3, extraUrls: [],
    fetchText: async () => sitemap('https://s.test/a', 'https://s.test/a#x', 'https://s.test/b', 'https://s.test/c'),
    visit: visitor({}, seen),
  });
  assert.deepEqual(seen, ['https://s.test/', 'https://s.test/a', 'https://s.test/b']);
  assert.equal(pages.length, 3);
});

test('discards foreign-origin sitemap URLs and falls back to following links', async () => {
  const seen = [];
  await crawl({
    baseUrl: 'https://s.test/', pageCap: 10, extraUrls: [],
    fetchText: async () => sitemap('https://prod.example.com/', 'https://prod.example.com/x'),
    visit: visitor({
      'https://s.test/': ['/about', 'https://other.test/', 'mailto:a@b.c', '/file.pdf', '/about#team'],
      'https://s.test/about': ['/'],
    }, seen),
  });
  assert.deepEqual(seen, ['https://s.test/', 'https://s.test/about']);
});

test('falls back to links when there is no sitemap and merges extra URLs', async () => {
  const seen = [];
  await crawl({
    baseUrl: 'https://s.test/', pageCap: 10, extraUrls: ['https://s.test/contact'],
    fetchText: async () => { throw new Error('404'); },
    visit: visitor({ 'https://s.test/': ['/team'] }, seen),
  });
  assert.deepEqual(seen, ['https://s.test/', 'https://s.test/contact', 'https://s.test/team']);
});

test('expands a sitemap index one level', async () => {
  const seen = [];
  await crawl({
    baseUrl: 'https://s.test/', pageCap: 10, extraUrls: [],
    fetchText: async (u) => u.endsWith('/sitemap.xml')
      ? '<sitemapindex><sitemap><loc>https://s.test/p.xml</loc></sitemap></sitemapindex>'
      : sitemap('https://s.test/p1'),
    visit: visitor({}, seen),
  });
  assert.deepEqual(seen, ['https://s.test/', 'https://s.test/p1']);
});

test('a visit that returns a failed page does not stop the crawl', async () => {
  const pages = await crawl({
    baseUrl: 'https://s.test/', pageCap: 5, extraUrls: ['https://s.test/slow'],
    fetchText: async () => { throw new Error('none'); },
    visit: async (url) => url.endsWith('/slow') ? { url, status: 0, error: 'timeout', links: [] } : { url, status: 200, links: [] },
  });
  assert.equal(pages.length, 2);
  assert.equal(pages[1].error, 'timeout');
});

test('drops foreign-origin extra URLs and keeps same-origin ones', async () => {
  const seen = [];
  await crawl({
    baseUrl: 'https://s.test/', pageCap: 10, extraUrls: ['https://evil.test/x', 'https://s.test/ok'],
    fetchText: async () => { throw new Error('none'); },
    visit: visitor({}, seen),
  });
  assert.deepEqual(seen, ['https://s.test/', 'https://s.test/ok']);
});
