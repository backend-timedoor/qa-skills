import { ok, bad, na, verdict } from '../lib/result.js';
import { livePages } from '../lib/pages.js';

export const metaOf = (p, key) =>
  p.metas.filter(m => (m.name || '').toLowerCase() === key || (m.property || '').toLowerCase() === key);

const OG = ['og:title', 'og:type', 'og:image', 'og:url'];
const UNIQUE_KEYS = [...OG, 'robots', 'description', 'keywords', 'keyword'];

export default {
  'SEO-001': (ev) => verdict(
    livePages(ev).filter(p => !p.title?.trim() || !metaOf(p, 'description').some(m => m.content?.trim())).map(p => p.url),
    'page(s) missing a title or meta description'),

  'SEO-002': (ev) => {
    const home = livePages(ev).find(p => p.isHome);
    if (!home) return na('Home page was not loaded');
    const tag = metaOf(home, 'keywords')[0] || metaOf(home, 'keyword')[0];
    const n = tag?.content ? tag.content.split(',').map(s => s.trim()).filter(Boolean).length : 0;
    return n >= 2 && n <= 5 ? ok() : bad(`Home page has ${n} meta keywords, expected 2-5`, [home.url]);
  },

  'SEO-017': (ev) => {
    const offenders = [];
    const missingAll = new Set();
    for (const p of livePages(ev)) {
      const missing = OG.filter(k => !metaOf(p, k).some(m => m.content?.trim()));
      if (missing.length) { offenders.push(p.url); missing.forEach(k => missingAll.add(k)); }
    }
    return offenders.length
      ? bad(`${offenders.length} page(s) missing OG tags (${[...missingAll].join(', ')})`, offenders)
      : ok();
  },

  'SEO-018': (ev) => verdict(
    livePages(ev).filter(p => UNIQUE_KEYS.some(k => metaOf(p, k).length > 1)).map(p => p.url),
    'page(s) with duplicated meta tags'),
};
