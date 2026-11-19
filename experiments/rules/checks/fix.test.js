// The hidden check of the fix task: copied into the project only after the run ends.

import assert from 'node:assert/strict';
import test from 'node:test';
import digest from '../src/jobs/digest.js';

const awake = { paused: false, quietStart: 22, quietEnd: 7 };
const at = (hour, minute) => new Date(2026, 10, 16, hour, minute);

test('the digest stays silent during quiet hours, and while paused', () => {
  assert.equal(digest.run(awake, at(23, 30), () => {}), false);
  assert.equal(digest.run(awake, at(3, 30), () => {}), false);
  assert.equal(digest.run({ ...awake, paused: true }, at(10, 30), () => {}), false);
});

test('the digest still goes out at half past outside quiet hours', () => {
  const sent = [];
  assert.equal(digest.run(awake, at(10, 30), (m) => sent.push(m)), true);
  assert.equal(sent.length, 1);
  assert.equal(digest.run(awake, at(10, 0), () => {}), false);
});
