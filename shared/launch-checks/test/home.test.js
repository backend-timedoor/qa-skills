import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHomeUrl } from '../capture/home.js';

test('isHomeUrl compares against the base URL, not "/"', () => {
  assert.equal(isHomeUrl('https://dev.host/project-x/', 'https://dev.host/project-x/'), true);
  assert.equal(isHomeUrl('https://dev.host/project-x', 'https://dev.host/project-x/'), true);
  assert.equal(isHomeUrl('https://dev.host/project-x/#top', 'https://dev.host/project-x'), true);
  assert.equal(isHomeUrl('https://dev.host/project-x/?a=1', 'https://dev.host/project-x/'), true);
  assert.equal(isHomeUrl('https://s.test/', 'https://s.test'), true);
  assert.equal(isHomeUrl('https://s.test', 'https://s.test/'), true);
  assert.equal(isHomeUrl('https://s.test/#x', 'https://s.test/'), true);
  assert.equal(isHomeUrl('https://dev.host/project-x/about', 'https://dev.host/project-x/'), false);
  assert.equal(isHomeUrl('https://dev.host/', 'https://dev.host/project-x/'), false);
  assert.equal(isHomeUrl('https://other.test/', 'https://s.test/'), false);
  assert.equal(isHomeUrl('https://s.test/about', 'https://s.test/'), false);
  assert.equal(isHomeUrl('not a url', 'https://s.test/'), false);
});
