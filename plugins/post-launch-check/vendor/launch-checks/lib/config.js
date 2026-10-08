import fs from 'node:fs';

export const DEFAULTS = {
  pageCap: 30, extraUrls: [], figmaUrl: '', language: 'en', timeoutMs: 30000,
  thresholds: { pagespeedMobile: 55, pagespeedDesktop: 85, imageKb: 100, heroImageKb: 200 },
};

export function loadConfig(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!raw.baseUrl) throw new Error('baseUrl is required in launch-check config');
  try { new URL(raw.baseUrl); } catch { throw new Error(`baseUrl is not a valid URL: ${raw.baseUrl}`); }
  return { ...DEFAULTS, ...raw, thresholds: { ...DEFAULTS.thresholds, ...(raw.thresholds || {}) } };
}

export function loadPhase(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!['pre', 'post'].includes(raw.phase)) throw new Error('phase must be "pre" or "post"');
  return { phase: raw.phase, expectations: raw.expectations || {} };
}
