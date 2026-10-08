import { verdict, bad, ok } from '../lib/result.js';
import { livePages } from '../lib/pages.js';

const HERO_MIN_WIDTH = 1000;

export default {
  'SEO-012': (ev) => verdict(
    livePages(ev).filter(p => p.images.some(i => i.alt === null)).map(p => p.url),
    'page(s) with images missing an alt attribute'),

  'IMG-001': (ev, ctx) => {
    const { imageKb, heroImageKb } = ctx.thresholds;
    const offenders = [];
    let count = 0;
    for (const p of livePages(ev)) {
      for (const i of p.images) {
        if (i.bytes == null) continue;
        const limit = (i.width >= HERO_MIN_WIDTH ? heroImageKb : imageKb) * 1024;
        if (i.bytes > limit) { count++; offenders.push(p.url); }
      }
    }
    return count ? bad(`${count} image(s) over the size limit`, [...new Set(offenders)]) : ok();
  },

  'IMG-002': (ev) => verdict(
    livePages(ev).filter(p => p.images.some(i => !i.inViewport && i.loading !== 'lazy')).map(p => p.url),
    'page(s) with below-the-fold images that are not lazy loaded'),
};
