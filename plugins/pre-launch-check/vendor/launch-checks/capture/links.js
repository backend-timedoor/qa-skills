async function status(url, fetchFn) {
  try {
    let r = await fetchFn(url, { method: 'HEAD', redirect: 'follow' });
    if ([403, 405, 501].includes(r.status)) r = await fetchFn(url, { method: 'GET', redirect: 'follow' });
    return r.status;
  } catch { return 0; }
}

export async function checkLinks(linkMap, fetchFn, { concurrency = 8, cap = 300 } = {}) {
  const entries = [...linkMap].filter(([u]) => /^https?:/i.test(u)).slice(0, cap);
  const broken = [];
  let next = 0;
  const worker = async () => {
    while (next < entries.length) {
      const [url, from] = entries[next++];
      const s = await status(url, fetchFn);
      if (s === 0 || s >= 400) broken.push({ url, status: s, from: [...new Set(from)] });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));
  return broken;
}
