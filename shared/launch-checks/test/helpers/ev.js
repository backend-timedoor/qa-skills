export const page = (o = {}) => ({
  url: 'https://x.test/', status: 200, isHome: true, title: 'Home', metas: [],
  headings: [{ level: 1, text: 'Home' }], images: [], links: [], footer: null,
  bodyText: '', scripts: { captcha: false, ga: false }, favicon: null,
  breadcrumb: null, mapEmbeds: 0, forms: [], ...o,
});
export const site = (o = {}) => ({
  expectedHost: 'x.test', robots: { status: 200, body: '' },
  redirects: { http: { finalUrl: 'https://x.test/' }, wwwHttp: { finalUrl: 'https://x.test/' } },
  notFound: { status: 404 }, brokenLinks: [], scripts: { captcha: false, ga: false },
  basicAuth: { challenged: false }, pagespeed: { mobile: 80, desktop: 90, error: null }, ...o,
});
export const evidence = (pages = [page()], s = site()) => ({
  baseUrl: 'https://x.test/', capturedAt: '2026-10-08T00:00:00.000Z', pages, site: s,
});
export const ctx = (o = {}) => ({
  expectations: { robotsMode: 'allow', metaRobots: 'index, follow' },
  thresholds: { pagespeedMobile: 55, pagespeedDesktop: 85, imageKb: 100, heroImageKb: 200 },
  language: 'en', figmaUrl: '', ...o,
});
