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
    const distinct = new Map();
    let count = 0;
    for (const p of livePages(ev)) {
      for (const i of p.images) {
        if (i.bytes == null) continue;
        const limit = (i.width >= HERO_MIN_WIDTH ? heroImageKb : imageKb) * 1024;
        if (i.bytes > limit) {
          count++; offenders.push(p.url);
          if (!distinct.has(i.src) || distinct.get(i.src).bytes < i.bytes) distinct.set(i.src, { src: i.src, bytes: i.bytes, page: p.url });
        }
      }
    }
    if (!count) return ok();
    const name = (src) => { try { return decodeURIComponent(new URL(src).pathname.split('/').filter(Boolean).pop() || src); } catch { return src; } };
    const heaviest = [...distinct.values()].sort((a, b) => b.bytes - a.bytes).slice(0, 3)
      .map(d => `${name(d.src)} ${Math.round(d.bytes / 1024)}KB on ${d.page}`).join(', ');
    return bad(`${distinct.size} distinct image(s) over the size limit (${count} occurrence(s)); heaviest: ${heaviest}`, [...new Set(offenders)]);
  },

  'IMG-002': (ev) => verdict(
    livePages(ev).filter(p => p.images.some(i => !i.inViewport && i.loading !== 'lazy')).map(p => p.url),
    'page(s) with below-the-fold images that are not lazy loaded'),
};
