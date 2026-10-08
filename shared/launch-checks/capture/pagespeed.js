import { withTimeout } from './probes.js';

export async function fetchPagespeed(url, strategy, apiKey, fetchFn = withTimeout(fetch, 60000)) {
  const q = new URLSearchParams({ url, strategy, category: 'performance' });
  if (apiKey) q.set('key', apiKey);
  try {
    const r = await fetchFn(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`);
    if (!r.ok) return { score: null, error: `HTTP ${r.status}` };
    const j = await r.json();
    const s = j?.lighthouseResult?.categories?.performance?.score;
    return typeof s === 'number' ? { score: Math.round(s * 100), error: null } : { score: null, error: 'no score in response' };
  } catch (e) {
    return { score: null, error: e.message };
  }
}
