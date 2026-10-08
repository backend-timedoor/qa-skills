import { createRequire } from 'node:module';
import path from 'node:path';
import { crawl } from './crawler.js';
import { extractPage, emptyPage } from './extract.js';
import { makeFetch, probeSite } from './probes.js';
import { checkLinks } from './links.js';
import { fetchPagespeed } from './pagespeed.js';

function loadPlaywright() {
  for (const base of [path.join(process.cwd(), 'launch-check'), process.cwd()]) {
    try { return createRequire(path.join(base, 'noop.js'))('playwright'); } catch { /* try next */ }
  }
  try { return createRequire(import.meta.url)('playwright'); } catch { /* fall through */ }
  throw new Error('Playwright is not installed. Run the setup skill (or: cd launch-check && npm install && npx playwright install chromium).');
}

export async function captureEvidence({ config, creds, pagespeedKey, onProgress = () => {} }) {
  const { chromium } = loadPlaywright();
  const base = new URL(config.baseUrl);
  const authedFetch = makeFetch(config.baseUrl, creds);
  const browser = await chromium.launch();
  const context = await browser.newContext(creds ? { httpCredentials: { username: creds.user, password: creds.password } } : {});
  try {
    const visit = async (url) => {
      const page = await context.newPage();
      try {
        const resp = await page.goto(url, { waitUntil: 'load', timeout: config.timeoutMs });
        const status = resp ? resp.status() : 0;
        const data = await extractPage(page);
        const u = new URL(url);
        onProgress(`visited ${url} (${status})`);
        return { url, status, isHome: u.origin === base.origin && u.pathname === '/', ...data };
      } catch (e) {
        onProgress(`failed ${url}: ${e.message}`);
        return emptyPage(url, e.message);
      } finally {
        await page.close();
      }
    };
    const fetchText = async (url) => {
      const r = await authedFetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    };
    const pages = await crawl({ baseUrl: config.baseUrl, pageCap: config.pageCap, extraUrls: config.extraUrls, fetchText, visit });

    const linkMap = new Map();
    for (const p of pages) for (const l of p.links) linkMap.set(l.href, [...(linkMap.get(l.href) || []), p.url]);
    const [probes, brokenLinks, mobile, desktop] = await Promise.all([
      probeSite(config.baseUrl, creds),
      checkLinks(linkMap, authedFetch),
      fetchPagespeed(config.baseUrl, 'mobile', pagespeedKey),
      fetchPagespeed(config.baseUrl, 'desktop', pagespeedKey),
    ]);
    const live = pages.filter(p => !p.error && p.status < 400);
    return {
      baseUrl: config.baseUrl,
      capturedAt: new Date().toISOString(),
      pages,
      site: {
        ...probes,
        brokenLinks,
        scripts: { captcha: live.some(p => p.scripts.captcha), ga: live.some(p => p.scripts.ga) },
        pagespeed: { mobile: mobile.score, desktop: desktop.score, error: mobile.error || desktop.error },
      },
    };
  } finally {
    await browser.close();
  }
}
