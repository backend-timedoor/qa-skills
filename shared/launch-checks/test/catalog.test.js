import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const rows = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../catalog/rows.json', import.meta.url)), 'utf8'));

test('row ids are unique and well formed', () => {
  const ids = rows.map(r => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const r of rows) {
    assert.match(r.id, /^[A-Z]+-\d{3}$/);
    assert.ok(['auto', 'review', 'manual'].includes(r.type), r.id);
    assert.ok(r.phases.every(p => ['pre', 'post'].includes(p)) && r.phases.length > 0, r.id);
    assert.ok(r.group && r.check && r.steps && r.expected, r.id);
  }
});

test('phase-only rows are pinned to the right phase', () => {
  const by = Object.fromEntries(rows.map(r => [r.id, r]));
  assert.deepEqual(by['AUTH-001'].phases, ['pre']);
  assert.deepEqual(by['GA-001'].phases, ['post']);
  assert.deepEqual(by['CAP-002'].phases, ['post']);
  assert.deepEqual(by['SEO-001'].phases, ['pre', 'post']);
});
