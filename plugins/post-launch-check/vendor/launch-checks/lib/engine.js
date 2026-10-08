import fs from 'node:fs';
import checks from '../checks/index.js';
import { livePages } from './pages.js';

export const loadRows = () =>
  JSON.parse(fs.readFileSync(new URL('../catalog/rows.json', import.meta.url), 'utf8'));

export function runChecks(evidence, phaseCfg, config) {
  const ctx = {
    expectations: phaseCfg.expectations,
    thresholds: config.thresholds,
    language: config.language,
    figmaUrl: config.figmaUrl,
  };
  const noPages = livePages(evidence).length === 0;
  return loadRows().filter(r => r.phases.includes(phaseCfg.phase)).map(row => {
    const base = { id: row.id, group: row.group, check: row.check, type: row.type, steps: row.steps, expected: row.expected };
    if (row.type === 'manual') {
      const figma = row.group === 'UI/UX' && config.figmaUrl ? `Figma: ${config.figmaUrl}` : '';
      return { ...base, status: 'manual-todo', reason: figma, pages: [] };
    }
    if (row.type === 'review') return { ...base, status: 'review-needed', reason: 'Awaiting Claude review', pages: [] };
    if (noPages) return { ...base, status: 'error', reason: 'No pages could be loaded', pages: [] };
    const fn = checks[row.id];
    if (!fn) return { ...base, status: 'error', reason: `No check implemented for ${row.id}`, pages: [] };
    try {
      const r = fn(evidence, ctx);
      return { ...base, status: r.status, reason: r.reason || '', pages: r.pages || [] };
    } catch (e) {
      return { ...base, status: 'error', reason: e.message, pages: [] };
    }
  });
}
