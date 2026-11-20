// The hidden check of the backlog task: copied into the project only after the run ends. Each test
// is one ticket of TICKETS.md, named "part <ticket>", and imports what it needs on its own, with
// data that no other ticket changes, so a ticket left undone or broken fails only its own part.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = async (file) => import(new URL(file, root).href);
const HEADER = 'date,block,variety,crates,weight';

/** Run the command line on a log file written from these rows; out and err as text. */
async function cli(rows, ...args) {
  const { main } = await load('src/cli.js');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'orchard-check-')), 'harvest.csv');
  fs.writeFileSync(file, [HEADER, ...rows].join('\n'));
  const out = [];
  const err = [];
  const code = main([args[0], file, ...args.slice(1)], (l) => out.push(String(l)), (l) => err.push(String(l)));
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const ROWS = ['2026-09-01,B2,gala,12,210', '2026-09-01,B4,fuji,9,162', '2026-09-15,B1,gala,10,180', '2026-09-30,B3,braeburn,8,140.5', '2026-10-02,B4,fuji,3,51'];

test('part ORCH-11: both ends of the range are included', async () => {
  const { parseLog } = await load('src/parse.js');
  const { summarize } = await load('src/summary.js');
  const records = parseLog([HEADER, ...ROWS].join('\n'));
  assert.deepEqual(summarize(records, { from: '2026-09-15', to: '2026-09-30' }), [
    { variety: 'braeburn', crates: 8, weightKg: 140.5 },
    { variety: 'gala', crates: 10, weightKg: 180 },
  ]);
});

test('part ORCH-12: a negative crate count or weight is refused, naming its line', async () => {
  const { parseLog } = await load('src/parse.js');
  assert.throws(() => parseLog([HEADER, '2026-09-01,B2,gala,12,210', '2026-09-01,B4,fuji,-9,162'].join('\n')), (e) => /^line 3:/.test(e.message));
  assert.throws(() => parseLog([HEADER, '2026-09-01,B2,gala,12,-210'].join('\n')), (e) => /^line 2:/.test(e.message));
  assert.equal(parseLog([HEADER, '2026-09-01,B2,gala,0,0'].join('\n')).length, 1);
});

test('part ORCH-13: --variety keeps one variety, whatever its case', async () => {
  const r = await cli(ROWS, 'summary', '--variety', 'Gala');
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /gala: 22 crates, 390\.0 kg/);
  assert.doesNotMatch(r.out, /fuji|braeburn/);
});

test('part ORCH-14: a weight in pounds is converted to kilograms', async () => {
  const { parseLog } = await load('src/parse.js');
  const records = parseLog([HEADER, '2026-09-01,B2,gala,12,462lb', '2026-09-01,B4,fuji,9,162kg', '2026-09-02,B1,gala,10,180'].join('\n'));
  assert.deepEqual(
    records.map((r) => r.weightKg),
    [209.6, 162, 180],
  );
});

test('part ORCH-15: the blocks come sorted, and the README says how', async () => {
  // In file order B2, B4, B1, B3; by name B1, B2, B3, B4; by weight B4, B2, B1, B3.
  const r = await cli(['2026-09-01,B2,gala,12,210', '2026-09-01,B4,fuji,9,162', '2026-09-02,B1,gala,10,180', '2026-09-03,B3,fuji,8,140', '2026-09-04,B4,fuji,6,100'], 'blocks');
  assert.equal(r.code, 0, r.err);
  const order = r.out
    .split('\n')
    .map((l) => /\b(B\d)\b/.exec(l)?.[1])
    .filter(Boolean)
    .join(',');
  assert.ok(['B1,B2,B3,B4', 'B4,B2,B1,B3'].includes(order), `blocks in the order ${order}`);
  // The order is said in a paragraph that names the blocks, or in the paragraph under a heading that does.
  const readme = fs.readFileSync(new URL('README.md', root), 'utf8');
  const paragraphs = readme.split(/\n\s*\n/);
  const sortWords = /sort|order|heaviest|alphabetic|by (block )?name|by (total )?weight/i;
  const said = paragraphs.some((p, i) => (/\bblocks?\b/.test(p) && sortWords.test(p)) || (/^#+ .*\bblocks\b/.test(p) && sortWords.test(paragraphs[i + 1] ?? '')));
  assert.ok(said, 'the README does not say how the blocks are sorted');
});

test('part ORCH-16: export-csv prints every picking with its weight in kilograms', async () => {
  const r = await cli(['2026-09-01,B2,gala,12,210', '2026-09-01,B4,fuji,9,162.25'], 'export-csv');
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out.trim(), ['date,block,variety,crates,weight_kg', '2026-09-01,B2,gala,12,210.0', '2026-09-01,B4,fuji,9,162.3'].join('\n'));
});

test('part ORCH-17: --json prints the summary as JSON', async () => {
  const r = await cli(ROWS, 'summary', '--from', '2026-09-02', '--json');
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(r.out), {
    from: '2026-09-02',
    to: null,
    varieties: [
      { variety: 'braeburn', crates: 8, weightKg: 140.5 },
      { variety: 'fuji', crates: 3, weightKg: 51 },
      { variety: 'gala', crates: 10, weightKg: 180 },
    ],
  });
});

test('part ORCH-18: the README documents every command and flag', () => {
  const readme = fs.readFileSync(new URL('README.md', root), 'utf8');
  for (const word of ['summary', 'blocks', 'export-csv', '--from', '--to', '--variety', '--json']) assert.ok(readme.includes(word), `the README does not mention ${word}`);
});
