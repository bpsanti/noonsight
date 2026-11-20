'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { parseLine, parseStock } = require('../src/parse.js');
const { expiring, low, report } = require('../src/stock.js');
const { run } = require('../src/cli.js');

const STOCK = parseStock(['# a comment', 'yogurt;dairy;24;pcs;2027-01-12', '', 'cream;dairy;1;l;2027-01-09', 'rice;dry;2;kg;', 'pasta;dry;3;kg;2028-02-01'].join('\n'));

test('a line gives the batch, and an empty expiry is none', () => {
  const it = parseLine('rice;dry;25;kg;');
  assert.equal(it.name, 'rice');
  assert.equal(it.category, 'dry');
  assert.equal(it.qty, 25);
  assert.equal(it.unit, 'kg');
  assert.equal(it.expires, null);
  assert.equal(parseLine('# comment'), null);
  assert.equal(STOCK.length, 4);
});

test('expiring lists what expires soon and leaves out what has expired', () => {
  assert.deepEqual(expiring(STOCK, '2027-01-10').map((it) => it.name), ['yogurt']);
});

test('low lists the batches with less than two left', () => {
  assert.deepEqual(low(STOCK).map((it) => it.name), ['cream']);
});

test('report totals each category', () => {
  assert.ok(report(STOCK).includes('dry: 5 kg'));
});

test('the command line lists the stock file', () => {
  const out = [];
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pantry-')), 'stock.txt');
  fs.writeFileSync(file, 'rice;dry;2;kg;\n');
  assert.equal(run(['list', file], { out: (s) => out.push(s), err: () => {} }), 0);
  assert.equal(out.length, 1);
  assert.match(out[0], /^rice dry 2 kg/);
});
