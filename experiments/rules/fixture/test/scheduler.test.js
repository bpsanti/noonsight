import assert from 'node:assert/strict';
import test from 'node:test';
import { tick } from '../src/scheduler.js';

const awake = { paused: false, quietStart: 22, quietEnd: 7 };
const at = (hour, minute, day = 15) => new Date(2026, 10, day, hour, minute);

test('the backup runs on the hour and stays silent while paused or in quiet hours', () => {
  const sent = [];
  assert.deepEqual(tick(awake, at(10, 0), (m) => sent.push(m)), ['backup', 'metrics']);
  assert.deepEqual(tick({ ...awake, paused: true }, at(10, 0), () => {}).includes('backup'), false);
  assert.deepEqual(tick(awake, at(23, 0), () => {}).includes('backup'), false);
});

test('the reminders go out at eight', () => {
  assert.ok(tick(awake, at(8, 0), () => {}).includes('reminders'));
  assert.ok(!tick(awake, at(9, 0), () => {}).includes('reminders'));
});

test('the cleanup runs on Sunday at nine', () => {
  assert.ok(tick(awake, at(9, 0, 15), () => {}).includes('cleanup'));
  assert.ok(!tick(awake, at(9, 0, 16), () => {}).includes('cleanup'));
});
