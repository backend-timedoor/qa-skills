const STATUSES = ['pass', 'fail', 'review-needed', 'manual-todo', 'n/a', 'error'];

const summarize = (rows) => {
  const s = Object.fromEntries(STATUSES.map(k => [k, 0]));
  for (const r of rows) s[r.status] += 1;
  return s;
};

export function buildReport({ site, phase, runDate, rows }) {
  return { site, phase, runDate, summary: summarize(rows), rows };
}

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();

export function renderMarkdown(report) {
  const label = report.phase === 'pre' ? 'pre-launch' : 'post-launch';
  const s = report.summary;
  const lines = [
    `# Launch check: ${label}`,
    '',
    `Site: ${report.site}  `,
    `Run date: ${report.runDate}`,
    '',
    STATUSES.map(k => `${k}: ${s[k]}`).join(' | '),
    '',
  ];
  const failures = report.rows.filter(r => r.status === 'fail' || r.status === 'error');
  if (failures.length) {
    lines.push('## Failures', '');
    for (const r of failures) lines.push(`- **${r.id}** ${cell(r.check)}: ${cell(r.reason)}`);
    lines.push('');
  }
  const groups = [...new Set(report.rows.map(r => r.group))];
  for (const g of groups) {
    lines.push(`## ${g}`, '', '| ID | Check | Status | Pages | Note |', '| --- | --- | --- | --- | --- |');
    for (const r of report.rows.filter(x => x.group === g)) {
      lines.push(`| ${r.id} | ${cell(r.check)} | ${r.status} | ${cell(r.pages.join(', '))} | ${cell(r.reason)} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function mergeReview(report, entries) {
  const ignored = [];
  for (const e of entries) {
    const row = report.rows.find(r => r.id === e.id);
    if (!row || row.type !== 'review') { ignored.push(e.id); continue; }
    if (e.status === 'pass' || e.status === 'fail') row.status = e.status;
    row.reason = e.reason || row.reason;
  }
  return { ...report, summary: summarize(report.rows), ignoredReview: ignored };
}
