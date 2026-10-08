import { ok, bad, review, na, verdict } from '../lib/result.js';
import { livePages } from '../lib/pages.js';
import { robotsBlocksAll } from '../lib/robots.js';
import { metaOf } from './meta.js';

const tokens = (s) => (s || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);

export default {
  'AUTH-001': (ev) => ev.site.basicAuth.challenged ? ok() : bad('The site did not ask for basic auth'),

  'GA-001': (ev) => ev.site.scripts.ga ? ok() : bad('No Google Analytics / gtag script found'),

  'CAP-001': (ev) => ev.site.scripts.captcha ? ok() : bad('No captcha script found'),

  'CRAWL-001': (ev, ctx) => {
    const { status, body } = ev.site.robots;
    const blocked = status === 200 && robotsBlocksAll(body);
    if (ctx.expectations.robotsMode === 'block') {
      return blocked ? ok() : bad(status === 200 ? 'robots.txt does not disallow all crawling' : `robots.txt not found (HTTP ${status}); crawling is allowed`);
    }
    return blocked ? bad('robots.txt disallows all crawling') : ok(status === 200 ? '' : 'No robots.txt; crawling is allowed');
  },

  'CRAWL-002': (ev, ctx) => {
    const wantNoindex = tokens(ctx.expectations.metaRobots).includes('noindex');
    const satisfies = (content) => {
      const t = tokens(content);
      return wantNoindex
        ? t.includes('none') || (t.includes('noindex') && t.includes('nofollow'))
        : !['noindex', 'nofollow', 'none'].some(x => t.includes(x));
    };
    const seen = [];
    const offenders = livePages(ev).filter(p => {
      const tags = [...metaOf(p, 'robots'), ...metaOf(p, 'googlebot')];
      const contents = tags.length === 0 ? ['index, follow'] : tags.map(t => t.content);
      const badOne = contents.find(c => !satisfies(c));
      if (badOne === undefined) return false;
      seen.push(tags.length === 0 ? 'no robots tag' : `"${badOne}"`);
      return true;
    }).map(p => p.url);
    const r = verdict(offenders, `page(s) whose meta robots / googlebot is not "${ctx.expectations.metaRobots}"`);
    return offenders.length ? { ...r, reason: `${r.reason} (e.g. ${[...new Set(seen)].slice(0, 3).join(', ')})` } : r;
  },

  'LINK-001': (ev) => {
    const broken = ev.site.brokenLinks;
    if (broken.length) {
      return bad(`${broken.length} broken link(s): ${broken.slice(0, 5).map(b => `${b.url} (${b.error || b.status})`).join(', ')}`, [...new Set(broken.flatMap(b => b.from))]);
    }
    const unverified = ev.site.unverifiedLinks || [];
    return unverified.length
      ? { ...review(`${unverified.length} external link(s) could not be verified (bot protection or timeout): ${unverified.slice(0, 5).map(u => u.url).join(', ')}. Check them by hand.`), pages: [...new Set(unverified.flatMap(u => u.from))] }
      : ok();
  },

  'LINK-002': (ev) => ev.site.notFound.status === 404 ? ok() : bad(`Unknown URL returned HTTP ${ev.site.notFound.status}, expected 404`),

  'HTTPS-001': (ev) => {
    const r = ev.site.redirects.http;
    if (r.error) return bad(`http:// request failed: ${r.error}`);
    return r.finalUrl?.startsWith('https://') ? ok() : bad(`http:// ended at ${r.finalUrl}`);
  },

  'HTTPS-002': (ev) => {
    const r = ev.site.redirects.wwwHttp;
    if (r.error === 'ENOTFOUND' || r.error === 'ENODATA') return na('http://www host has no DNS record, so there is nothing to redirect');
    if (r.error) return review(`Could not request the http://www host (${r.error}); check it by hand`);
    let host = '';
    try { host = new URL(r.finalUrl).host; } catch { /* handled below */ }
    return r.finalUrl?.startsWith('https://') && host === ev.site.expectedHost
      ? ok() : bad(`http://www ended at ${r.finalUrl}, expected https://${ev.site.expectedHost}`);
  },

  'PERF-001': (ev, ctx) => {
    const { mobile, desktop, error } = ev.site.pagespeed;
    if (mobile == null || desktop == null) {
      return review(`PageSpeed unavailable (${error || 'no result'}); set PAGESPEED_API_KEY in .env (free key from Google Cloud) or run pagespeed.web.dev by hand`);
    }
    const { pagespeedMobile, pagespeedDesktop } = ctx.thresholds;
    const problems = [];
    if (mobile < pagespeedMobile) problems.push(`mobile ${mobile} < ${pagespeedMobile}`);
    if (desktop < pagespeedDesktop) problems.push(`desktop ${desktop} < ${pagespeedDesktop}`);
    return problems.length ? bad(problems.join('; ')) : ok(`mobile ${mobile}, desktop ${desktop}`);
  },
};
