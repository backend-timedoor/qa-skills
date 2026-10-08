import { verdict, bad, ok } from '../lib/result.js';
import { livePages } from '../lib/pages.js';

const h1s = (p) => p.headings.filter(h => h.level === 1);
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export default {
  'SEO-005': (ev) => verdict(livePages(ev).filter(p => h1s(p).length === 0).map(p => p.url), 'page(s) without an H1'),

  'SEO-006': (ev) => {
    const byText = new Map();
    for (const p of livePages(ev)) {
      const first = h1s(p)[0];
      if (!first) continue;
      const key = norm(first.text);
      byText.set(key, [...(byText.get(key) || []), p.url]);
    }
    const dupes = [...byText.values()].filter(urls => urls.length > 1).flat();
    return dupes.length ? bad(`${dupes.length} page(s) share an H1 with another page`, dupes) : ok();
  },

  'SEO-007': (ev) => verdict(livePages(ev).filter(p => h1s(p).length > 1).map(p => p.url), 'page(s) with more than one H1'),

  'SEO-009': (ev) => {
    const offenders = livePages(ev).filter(p => {
      let prev = 0;
      return p.headings.some((h, i) => {
        const invalid = h.level > prev + 1 || (h.level === 1 && i > 0);
        prev = h.level;
        return invalid;
      });
    }).map(p => p.url);
    return verdict(offenders, 'page(s) with headings out of order');
  },
};
