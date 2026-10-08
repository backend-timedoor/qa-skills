export const emptyPage = (url, error) => ({
  url, status: 0, error, isHome: false, title: '', metas: [], headings: [], images: [], links: [],
  footer: null, bodyText: '', scripts: { captcha: false, ga: false }, favicon: null,
  breadcrumb: null, mapEmbeds: 0, forms: [],
});

export async function extractPage(page) {
  return page.evaluate(() => {
    const abs = (h) => { try { return new URL(h, location.href).href; } catch { return null; } };
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const sizes = new Map(performance.getEntriesByType('resource').map(e => [e.name, e.encodedBodySize || e.transferSize || null]));
    const scriptSrcs = [...document.scripts].map(s => s.src).filter(Boolean);
    const inline = [...document.scripts].filter(s => !s.src).map(s => s.textContent).join('\n');
    const footerEl = document.querySelector('footer');
    let footer = null;
    if (footerEl) {
      const a = [...footerEl.querySelectorAll('a')].find(x => /timedoor/i.test(x.textContent + x.href));
      footer = {
        text: clean(footerEl.innerText),
        creditLink: a ? { href: a.href, target: a.getAttribute('target'), color: getComputedStyle(a).color } : null,
        textColor: a ? getComputedStyle(a.parentElement).color : getComputedStyle(footerEl).color,
      };
    }
    const crumb = document.querySelector('[aria-label*="breadcrumb" i], .breadcrumb, .breadcrumbs, nav.breadcrumb');
    const icon = document.querySelector('link[rel~="icon"]');
    return {
      title: clean(document.title),
      metas: [...document.querySelectorAll('meta')]
        .map(m => ({ name: m.getAttribute('name'), property: m.getAttribute('property'), content: m.getAttribute('content') }))
        .filter(m => m.name || m.property),
      headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => ({ level: Number(h.tagName[1]), text: clean(h.textContent) })),
      images: [...document.images].map(i => {
        const r = i.getBoundingClientRect();
        const src = i.currentSrc || i.src;
        return {
          src, alt: i.getAttribute('alt'), loading: i.getAttribute('loading'), bytes: sizes.get(src) ?? null,
          width: Math.round(r.width), height: Math.round(r.height),
          naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight, inViewport: r.top < window.innerHeight,
        };
      }),
      links: [...document.querySelectorAll('a[href]')].map(a => ({ href: abs(a.getAttribute('href')), text: clean(a.textContent) })).filter(l => l.href),
      footer,
      bodyText: document.body ? document.body.innerText : '',
      scripts: {
        captcha: scriptSrcs.some(s => /recaptcha|hcaptcha|turnstile/i.test(s)) || !!document.querySelector('.g-recaptcha, .h-captcha, .cf-turnstile'),
        ga: scriptSrcs.some(s => /googletagmanager\.com|google-analytics\.com/i.test(s)) || /gtag\(|GoogleAnalyticsObject/.test(inline),
      },
      favicon: icon ? abs(icon.getAttribute('href')) : null,
      breadcrumb: crumb ? clean(crumb.innerText) : null,
      mapEmbeds: document.querySelectorAll('iframe[src*="google.com/maps"], .gm-style').length,
      forms: [...document.forms].map(f => ({
        fields: [...f.elements].filter(e => e.name || e.type).map(e => ({ type: e.type || e.tagName.toLowerCase(), name: e.name || null, required: !!e.required })),
      })),
    };
  });
}
