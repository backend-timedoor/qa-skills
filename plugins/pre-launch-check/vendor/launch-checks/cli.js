#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, loadPhase } from './lib/config.js';
import { loadEnv } from './lib/env.js';
import { runChecks } from './lib/engine.js';
import { buildReport, renderMarkdown, mergeReview } from './lib/report.js';
import { detectPhaseMismatch } from './lib/guard.js';
import { probeHome, withTimeout } from './capture/probes.js';
import { captureEvidence } from './capture/capture.js';

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const flags = {};
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) {
      const key = rest[i].slice(2);
      const next = rest[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = true; else { flags[key] = next; i++; }
    } else positional.push(rest[i]);
  }
  return { cmd, flags, positional };
}

const writeJson = (file, obj) => fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

async function run(flags) {
  for (const f of ['config', 'phase', 'out']) if (!flags[f] || flags[f] === true) throw new Error(`--${f} is required`);
  loadEnv('.env');
  const config = loadConfig(flags.config);
  const phaseCfg = loadPhase(flags.phase);
  const creds = process.env.BASIC_AUTH_USER ? { user: process.env.BASIC_AUTH_USER, password: process.env.BASIC_AUTH_PASSWORD || '' } : null;

  const warning = detectPhaseMismatch(phaseCfg.phase, await probeHome(config.baseUrl, creds, withTimeout(fetch, config.timeoutMs)));
  if (warning && !flags.yes) {
    console.error(`WARNING: ${warning}\nRe-run with --yes to continue.`);
    return 2;
  }

  const evidence = await captureEvidence({ config, creds, pagespeedKey: process.env.PAGESPEED_API_KEY, onProgress: (m) => console.log(m) });
  const rows = runChecks(evidence, phaseCfg, config);
  const report = buildReport({ site: config.baseUrl, phase: phaseCfg.phase, runDate: evidence.capturedAt.slice(0, 10), rows });

  fs.mkdirSync(flags.out, { recursive: true });
  writeJson(path.join(flags.out, 'evidence.json'), evidence);
  writeJson(path.join(flags.out, 'report.json'), report);
  fs.writeFileSync(path.join(flags.out, 'report.md'), renderMarkdown(report));
  console.log(`Report written to ${flags.out}/report.md`);
  console.log(Object.entries(report.summary).map(([k, v]) => `${k}: ${v}`).join(' | '));
  return 0;
}

function mergeReviewCmd(dir) {
  const report = mergeReview(readJson(path.join(dir, 'report.json')), readJson(path.join(dir, 'review.json')));
  writeJson(path.join(dir, 'report.json'), report);
  fs.writeFileSync(path.join(dir, 'report.md'), renderMarkdown(report));
  if (report.ignoredReview?.length) console.warn(`Ignored review entries: ${report.ignoredReview.join(', ')}`);
  console.log(Object.entries(report.summary).map(([k, v]) => `${k}: ${v}`).join(' | '));
  return 0;
}

function renderCmd(dir) {
  fs.writeFileSync(path.join(dir, 'report.md'), renderMarkdown(readJson(path.join(dir, 'report.json'))));
  return 0;
}

const { cmd, flags, positional } = parseArgs(process.argv.slice(2));
try {
  const code = cmd === 'run' ? await run(flags)
    : cmd === 'merge-review' ? mergeReviewCmd(positional[0])
    : cmd === 'render' ? renderCmd(positional[0])
    : (console.error('Usage: cli.js run --config F --phase F --out DIR [--yes] | merge-review DIR | render DIR'), 1);
  process.exit(code);
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
