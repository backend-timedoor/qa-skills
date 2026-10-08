import { ok, bad, review, verdict } from '../lib/result.js';
import { livePages } from '../lib/pages.js';
import { robotsBlocksAll } from '../lib/robots.js';
import { metaOf } from './meta.js';

const normRobots = (s) => (s || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean).sort().join(',');

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
    const want = normRobots(ctx.expectations.metaRobots);
    const offenders = livePages(ev).filter(p => {
      const tags = [...metaOf(p, 'robots'), ...metaOf(p, 'googlebot')];
      if (tags.length === 0) return want !== normRobots('index, follow');
      return tags.some(t => normRobots(t.content) !== want);
    }).map(p => p.url);
    return verdict(offenders, `page(s) whose meta robots / googlebot is not "${ctx.expectations.metaRobots}"`);
  },

  'LINK-001': (ev) => {
    const broken = ev.site.brokenLinks;
    return broken.length
      ? bad(`${broken.length} broken link(s): ${broken.slice(0, 5).map(b => `${b.url} (${b.status})`).join(', ')}`, [...new Set(broken.flatMap(b => b.from))])
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
    if (r.error) return review(`Could not request the http://www host (${r.error}); check it by hand`);
    let host = '';
    try { host = new URL(r.finalUrl).host; } catch { /* handled below */ }
    return r.finalUrl?.startsWith('https://') && host === ev.site.expectedHost
      ? ok() : bad(`http://www ended at ${r.finalUrl}, expected https://${ev.site.expectedHost}`);
  },

  'PERF-001': (ev, ctx) => {
    const { mobile, desktop, error } = ev.site.pagespeed;
    if (mobile == null || desktop == null) {
      return review(`PageSpeed unavailable (${error || 'no result'}); run pagespeed.web.dev by hand`);
    }
    const { pagespeedMobile, pagespeedDesktop } = ctx.thresholds;
    const problems = [];
    if (mobile < pagespeedMobile) problems.push(`mobile ${mobile} < ${pagespeedMobile}`);
    if (desktop < pagespeedDesktop) problems.push(`desktop ${desktop} < ${pagespeedDesktop}`);
    return problems.length ? bad(problems.join('; ')) : ok(`mobile ${mobile}, desktop ${desktop}`);
  },
};
