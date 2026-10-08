import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPhase } from '../lib/config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (...p) => JSON.parse(fs.readFileSync(path.join(root, ...p), 'utf8'));

for (const [name, phase, robotsMode, metaRobots] of [
  ['pre-launch-check', 'pre', 'block', 'noindex, nofollow'],
  ['post-launch-check', 'post', 'allow', 'index, follow'],
]) {
  test(`${name} is complete and registered`, () => {
    const dir = path.join(root, 'plugins', name);
    assert.equal(read('plugins', name, '.claude-plugin', 'plugin.json').name, name);
    const cfg = loadPhase(path.join(dir, 'phase.json'));
    assert.equal(cfg.phase, phase);
    assert.equal(cfg.expectations.robotsMode, robotsMode);
    assert.equal(cfg.expectations.metaRobots, metaRobots);
    for (const skill of [`setup-${name}`, name, 'review-checklist']) {
      const text = fs.readFileSync(path.join(dir, 'skills', skill, 'SKILL.md'), 'utf8');
      assert.match(text, new RegExp(`^---\\nname: ${skill}\\ndescription: .+\\n---`));
    }
    for (const f of ['launch-check.config.example.json', 'notion.env.example', 'package.json']) {
      assert.ok(fs.existsSync(path.join(dir, 'templates', f)), f);
    }
    assert.ok(fs.existsSync(path.join(dir, 'vendor/launch-checks/cli.js')));
    const reg = read('.claude-plugin', 'marketplace.json').plugins.find(p => p.name === name);
    assert.equal(reg.source, `./plugins/${name}`);
  });
}
