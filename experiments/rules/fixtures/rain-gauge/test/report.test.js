import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReadings } from '../src/readings.js';
import { seasonReport } from '../src/report.js';
import { toMillimetres } from '../src/units.js';

const readings = parseReadings(`
# station,hour,mm
north,5,2.5
north,30,1.0
north,200,4.0
south,12,3.0
north,250,0.5
`);

test('the season report gives each week and the season for one station', () => {
  assert.equal(seasonReport(readings, 'north', 2), ['Station north', 'week 1: 3.5 mm', 'week 2: 4.5 mm', 'season: 8.0 mm'].join('\n'));
});

test('readings from other stations stay out of the report', () => {
  assert.equal(seasonReport(readings, 'south', 1), ['Station south', 'week 1: 3.0 mm', 'season: 3.0 mm'].join('\n'));
});

test('inches convert to millimetres', () => {
  assert.equal(toMillimetres(2, 'in'), 50.8);
  assert.equal(toMillimetres(3, 'mm'), 3);
});
