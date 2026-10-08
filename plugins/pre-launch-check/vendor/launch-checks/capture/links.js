const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const errCode = (e) => e?.cause?.code || e?.name;

async function attempt(url, fetchFn, method) {
  try {
    let r = await fetchFn(url, { method, redirect: 'follow' });
    if (method === 'HEAD' && [403, 405, 501].includes(r.status)) r = await fetchFn(url, { method: 'GET', redirect: 'follow' });
    return { status: r.status };
  } catch (e) { return { status: 0, error: errCode(e) }; }
}

async function probe(url, fetchFn, retryDelayMs) {
  let r = await attempt(url, fetchFn, 'HEAD');
  if (r.error || r.status >= 500) {
    await sleep(retryDelayMs);
    r = await attempt(url, fetchFn, 'GET');
  }
  return r;
}

export async function checkLinks(linkMap, fetchFn, { concurrency = 4, cap = 300, baseOrigin, retryDelayMs = 500 } = {}) {
  const entries = [...linkMap].filter(([u]) => /^https?:/i.test(u)).slice(0, cap);
  const broken = [];
  const unverified = [];
  let next = 0;
  const worker = async () => {
    while (next < entries.length) {
      const [url, from] = entries[next++];
      const { status, error } = await probe(url, fetchFn, retryDelayMs);
      if (status > 0 && status < 400) continue;
      const item = { url, status, ...(error ? { error } : {}), from: [...new Set(from)] };
      const internal = new URL(url).origin === baseOrigin;
      (status === 404 || status === 410 || internal ? broken : unverified).push(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));
  return { broken, unverified };
}

export function buildLinkMap(pages) {
  const map = new Map();
  for (const p of pages) {
    for (const l of p.links || []) {
      let u;
      try { u = new URL(l.href); } catch { continue; }
      if (!/^https?:$/.test(u.protocol)) continue;
      u.hash = '';
      map.set(u.href, [...(map.get(u.href) || []), p.url]);
    }
  }
  return map;
}
