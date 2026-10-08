import { robotsBlocksAll } from '../lib/robots.js';

export function withTimeout(rawFetch = fetch, ms = 15000) {
  return (url, init = {}) => rawFetch(url, init.signal ? init : { ...init, signal: AbortSignal.timeout(ms) });
}

export function makeFetch(baseUrl, creds, rawFetch = fetch) {
  const origin = new URL(baseUrl).origin;
  const auth = creds ? 'Basic ' + Buffer.from(`${creds.user}:${creds.password}`).toString('base64') : null;
  return (url, init = {}) => {
    const sameOrigin = (() => { try { return new URL(url).origin === origin; } catch { return false; } })();
    const headers = { ...(init.headers || {}) };
    if (auth && sameOrigin) headers.Authorization = auth;
    return rawFetch(url, { ...init, headers });
  };
}

const NOINDEX = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i;

export async function probeHome(baseUrl, creds, rawFetch = fetch) {
  const origin = new URL(baseUrl).origin;
  const authed = makeFetch(baseUrl, creds, rawFetch);
  let basicAuth = false;
  try { basicAuth = (await rawFetch(baseUrl, { redirect: 'follow' })).status === 401; } catch { /* unreachable: treated as no auth */ }
  let metaNoindex = false;
  try { metaNoindex = NOINDEX.test(await (await authed(baseUrl, { redirect: 'follow' })).text()); } catch { /* ignore */ }
  let robotsBlocked = false;
  try {
    const r = await authed(`${origin}/robots.txt`);
    robotsBlocked = r.status === 200 && robotsBlocksAll(await r.text());
  } catch { /* ignore */ }
  return { robotsBlocked, metaNoindex, basicAuth };
}

async function redirectProbe(url, rawFetch) {
  try { return { finalUrl: (await rawFetch(url, { redirect: 'follow' })).url }; }
  catch (e) { return { error: e.cause?.code || e.message }; }
}

export async function probeSite(baseUrl, creds, rawFetch = fetch) {
  const u = new URL(baseUrl);
  const authed = makeFetch(baseUrl, creds, rawFetch);
  const bareHost = u.host.replace(/^www\./, '');
  const [http, wwwHttp] = await Promise.all([
    redirectProbe(`http://${u.host}/`, rawFetch),
    redirectProbe(`http://www.${bareHost}/`, rawFetch),
  ]);
  let robots = { status: 0, body: '' };
  try {
    const r = await authed(`${u.origin}/robots.txt`);
    robots = { status: r.status, body: r.status === 200 ? await r.text() : '' };
  } catch { /* leave status 0 */ }
  let notFound = { status: 0 };
  try { notFound = { status: (await authed(`${u.origin}/__launch-check-404-${Date.now()}`)).status }; } catch { /* leave 0 */ }
  let challenged = false;
  try { challenged = (await rawFetch(baseUrl, { redirect: 'follow' })).status === 401; } catch { /* ignore */ }
  return { expectedHost: u.host, robots, redirects: { http, wwwHttp }, notFound, basicAuth: { challenged } };
}
