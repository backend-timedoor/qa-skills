import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPhaseMismatch } from '../lib/guard.js';

const probe = (o = {}) => ({ robotsBlocked: false, metaNoindex: false, basicAuth: false, ...o });

test('pre-launch warns when the site looks live', () => {
  assert.match(detectPhaseMismatch('pre', probe()), /looks live/i);
  assert.equal(detectPhaseMismatch('pre', probe({ basicAuth: true })), null);
  assert.equal(detectPhaseMismatch('pre', probe({ metaNoindex: true })), null);
  assert.equal(detectPhaseMismatch('pre', probe({ robotsBlocked: true })), null);
});

test('post-launch warns when the site looks like staging', () => {
  assert.equal(detectPhaseMismatch('post', probe()), null);
  assert.match(detectPhaseMismatch('post', probe({ basicAuth: true })), /staging/i);
  assert.match(detectPhaseMismatch('post', probe({ metaNoindex: true })), /staging/i);
  assert.match(detectPhaseMismatch('post', probe({ robotsBlocked: true })), /staging/i);
});
