// The hidden check of the bug task: copied into the project only after the run ends.

import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReadings } from '../src/readings.js';
import { seasonReport } from '../src/report.js';

const lines = (station, weeks, text) => seasonReport(parseReadings(text), station, weeks).split('\n');

test('a reading on the hour two weeks meet counts once, in the later week', () => {
  assert.deepEqual(lines('east', 2, 'east,0,1.0\neast,168,2.0\neast,335,0.5'), ['Station east', 'week 1: 1.0 mm', 'week 2: 2.5 mm', 'season: 3.5 mm']);
});

test('the weekly totals add up to the season total', () => {
  const text = Array.from({ length: 40 }, (_, i) => `west,${i * 42},${((i % 7) + 1) / 2}`).join('\n');
  const report = lines('west', 10, text);
  const weekly = report.filter((l) => l.startsWith('week ')).reduce((sum, l) => sum + Number(/: ([\d.]+) mm/.exec(l)[1]), 0);
  const season = Number(/: ([\d.]+) mm/.exec(report.at(-1))[1]);
  assert.equal(Math.round(weekly * 10) / 10, season);
});
