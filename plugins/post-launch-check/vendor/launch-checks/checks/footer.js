import { ok, bad, na, verdict } from '../lib/result.js';
import { livePages } from '../lib/pages.js';

const CREDIT = /powered by pt\.? timedoor indonesia/i;

export default {
  'SEO-015': (ev) => {
    const home = livePages(ev).find(p => p.isHome);
    if (!home) return na('Home page was not loaded');
    const f = home.footer;
    if (!f || !CREDIT.test(f.text)) return bad('Home footer has no "Powered by PT Timedoor Indonesia"', [home.url]);
    const link = f.creditLink;
    if (!link || !/timedoor\.net/i.test(link.href)) return bad('Credit is not linked to timedoor.net', [home.url]);
    if (link.target !== '_blank') return bad('Credit link does not open in a new tab (target="_blank")', [home.url]);
    if (link.color !== f.textColor) return bad('Credit link color differs from the footer text color', [home.url]);
    return ok();
  },

  'SEO-016': (ev) => verdict(
    livePages(ev).filter(p => !p.isHome && p.footer && CREDIT.test(p.footer.text)).map(p => p.url),
    'non-home page(s) carry the Powered by credit'),
};
