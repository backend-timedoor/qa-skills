const key = (u) => { const x = new URL(u); return x.origin + x.pathname.replace(/\/+$/, ''); };

export function isHomeUrl(url, baseUrl) {
  try { return key(url) === key(baseUrl); } catch { return false; }
}
