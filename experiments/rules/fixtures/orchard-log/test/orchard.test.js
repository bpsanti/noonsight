import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { blockTotals } from '../src/blocks.js';
import { main } from '../src/cli.js';
import { parseLog } from '../src/parse.js';
import { summarize } from '../src/summary.js';

const LOG = ['date,block,variety,crates,weight', '2026-09-01,B2,gala,12,210', '2026-09-01,B4,Fuji,9,162', '# a comment', '', '2026-09-08,B2,gala,12,212.5'].join('\n');

test('parseLog reads every row, skips comments and blank lines, and lowercases the variety', () => {
  assert.deepEqual(parseLog(LOG), [
    { date: '2026-09-01', block: 'B2', variety: 'gala', crates: 12, weightKg: 210 },
    { date: '2026-09-01', block: 'B4', variety: 'fuji', crates: 9, weightKg: 162 },
    { date: '2026-09-08', block: 'B2', variety: 'gala', crates: 12, weightKg: 212.5 },
  ]);
});

test('parseLog names the line of a malformed row', () => {
  assert.throws(() => parseLog('date,block,variety,crates,weight\n2026-09-01,B2,gala,twelve,210'), /^Error: line 2:/);
  assert.throws(() => parseLog('date,block\n'), /^Error: line 1:/);
});

test('summarize totals each variety, by name, within a range', () => {
  const records = parseLog(LOG);
  assert.deepEqual(summarize(records), [
    { variety: 'fuji', crates: 9, weightKg: 162 },
    { variety: 'gala', crates: 24, weightKg: 422.5 },
  ]);
  assert.deepEqual(summarize(records, { from: '2026-09-02' }), [{ variety: 'gala', crates: 12, weightKg: 212.5 }]);
});

test('blockTotals totals each block', () => {
  const totals = blockTotals(parseLog(LOG));
  assert.deepEqual(
    [...totals].sort((a, b) => a.block.localeCompare(b.block)),
    [
      { block: 'B2', crates: 24, weightKg: 422.5 },
      { block: 'B4', crates: 9, weightKg: 162 },
    ],
  );
});

test('the command line prints the summary, and refuses an unknown command', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'orchard-')), 'harvest.csv');
  fs.writeFileSync(file, LOG);
  const out = [];
  assert.equal(main(['summary', file], (l) => out.push(l), () => {}), 0);
  assert.equal(out.join('\n'), 'fuji: 9 crates, 162.0 kg\ngala: 24 crates, 422.5 kg');
  assert.equal(main(['plant', file], () => {}, () => {}), 2);
});
