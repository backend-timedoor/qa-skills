const SKIP_EXT = /\.(?:pdf|zip|jpe?g|png|gif|webp|svg|ico|mp4|mp3|docx?|xlsx?|pptx?|css|js)$/i;

const stripHash = (u) => { const x = new URL(u); x.hash = ''; return x.href; };

function sameOriginPage(href, origin, base) {
  try {
    const u = new URL(href, base);
    if (!/^https?:$/.test(u.protocol) || u.origin !== origin || SKIP_EXT.test(u.pathname)) return null;
    u.hash = '';
    return u.href;
  } catch { return null; }
}

const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);

async function readSitemap(origin, fetchText, cap) {
  let first;
  try { first = await fetchText(`${origin}/sitemap.xml`); } catch { return []; }
  let urls = locs(first);
  if (/<sitemapindex/i.test(first)) {
    urls = [];
    for (const child of locs(first).slice(0, 5)) {
      try { urls.push(...locs(await fetchText(child))); } catch { /* skip unreadable child */ }
    }
  }
  return urls.map(u => sameOriginPage(u, origin)).filter(Boolean).slice(0, cap);
}

export async function crawl({ baseUrl, pageCap, extraUrls = [], fetchText, visit }) {
  const origin = new URL(baseUrl).origin;
  const sitemapUrls = await readSitemap(origin, fetchText, pageCap);
  const followLinks = sitemapUrls.length === 0;
  const queue = [stripHash(baseUrl), ...extraUrls.map(stripHash), ...sitemapUrls];
  const seen = new Set();
  const pages = [];
  while (queue.length && pages.length < pageCap) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const page = await visit(url);
    pages.push(page);
    if (followLinks) {
      for (const l of page.links || []) {
        const next = sameOriginPage(l.href, origin, page.url || url);
        if (next && !seen.has(next)) queue.push(next);
      }
    }
  }
  return pages;
}
