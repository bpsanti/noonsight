// The hidden check of the task `triage` (pantry-stock): one part per ticket that asks for work, and
// one for the way TICKETS.md says to close tickets. The parked ticket (PAN-28) and the duplicate
// (PAN-31) ask for no change of code. Each part runs the command line or loads a module on its own,
// with a stock file of its own, so a part left undone or broken fails only itself.
//
// Where a ticket leaves a choice open (PAN-24, PAN-25, PAN-32), the part accepts every choice that
// does what the ticket asks: any window shorter than 7 days for produce and longer than 7 for canned
// goods, whole numbers or one decimal, and any new name for the option.

'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'pantry.js');

function stockFile(lines) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pantry-check-')), 'stock.txt');
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
  return file;
}

/** Run `pantry <command> <file> ...rest` on a stock file. */
function pantry(command, file, rest = []) {
  const r = spawnSync(process.execPath, [BIN, command, file, ...rest], { cwd: ROOT, encoding: 'utf8', timeout: 10_000 });
  return { status: r.status, out: r.stdout ?? '', err: r.stderr ?? '', all: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}

const has = (text, word) => new RegExp(`(^|[^A-Za-z0-9_-])${word}([^A-Za-z0-9_-]|$)`, 'm').test(text);

function load(file) {
  const resolved = require.resolve(file);
  delete require.cache[resolved];
  return require(resolved);
}

test('part PAN-21', () => {
  const file = stockFile(['yogurt;dairy;24;pcs;2027-01-10', 'cream;dairy;1;l;2027-01-09', 'milk;dairy;6;l;2027-01-12']);
  const r = pantry('expiring', file, ['--today', '2027-01-10']);
  assert.equal(r.status, 0, r.err);
  assert.ok(has(r.out, 'yogurt'), 'what expires today is listed');
  assert.ok(!has(r.out, 'cream'), 'what expired yesterday is left out');
});

test('part PAN-22', () => {
  // Read through the parser, or else through the command line, wherever the comma is handled.
  let parsed = null;
  try {
    const { parseStock } = load(path.join(ROOT, 'src', 'parse.js'));
    const items = parseStock('rice;dry;1,5;kg;\nbeans;canned;2,25;pcs;\noil;dry;3;l;\n');
    parsed = items.map((it) => it.qty);
  } catch {
    parsed = null;
  }
  if (parsed && parsed[0] === 1.5 && parsed[1] === 2.25 && parsed[2] === 3) return;
  const file = stockFile(['rice;dry;1,5;kg;', 'beans;canned;2,25;pcs;']);
  const above = pantry('low', file, ['--min', '1.2']);
  const below = pantry('low', file, ['--min', '2.3']);
  assert.equal(above.status, 0, above.err);
  assert.ok(!has(above.out, 'rice'), '1,5 is more than 1.2');
  assert.ok(has(below.out, 'rice') && has(below.out, 'beans'), '1,5 and 2,25 are less than 2.3');
  assert.ok(!has(pantry('low', file, ['--min', '2.2']).out, 'beans'), '2,25 is more than 2.2');
});

test('part PAN-23', () => {
  const file = stockFile(['milk;dairy;6;l;2027-01-15', 'apples;produce;12;kg;2027-01-14', 'yogurt;dairy;24;pcs;2027-01-11', 'rice;dry;25;kg;']);
  const r = pantry('list', file, ['--category', 'dairy']);
  assert.equal(r.status, 0, r.err);
  assert.ok(has(r.out, 'milk') && has(r.out, 'yogurt'), 'the dairy batches');
  assert.ok(!has(r.out, 'apples') && !has(r.out, 'rice'), 'nothing else');
});

test('part PAN-24', () => {
  const file = stockFile(['lettuce;produce;2;kg;2027-01-17', 'spinach;produce;1;kg;2027-01-11', 'beans;canned;30;pcs;2027-01-18', 'corn;canned;12;pcs;2027-01-13']);
  const r = pantry('expiring', file, ['--today', '2027-01-10']);
  assert.equal(r.status, 0, r.err);
  assert.ok(!has(r.out, 'lettuce'), 'produce has a window shorter than 7 days');
  assert.ok(has(r.out, 'spinach'), 'produce that expires tomorrow is listed');
  assert.ok(has(r.out, 'beans'), 'canned goods have a window longer than 7 days');
  assert.ok(has(r.out, 'corn'), 'canned goods that expire in 3 days are listed');
});

test('part PAN-25', () => {
  const file = stockFile(['rice;dry;1.1;kg;', 'rice;dry;2.2;kg;', 'beans;canned;3;pcs;']);
  const r = pantry('report', file);
  assert.equal(r.status, 0, r.err);
  assert.ok(!/[0-9][.,][0-9]{2,}/.test(r.out), `no quantity with two decimals or more:\n${r.out}`);
  const dry = r.out.split('\n').filter((l) => has(l, 'dry'));
  assert.equal(dry.length, 1, r.out);
  const n = (dry[0].match(/[0-9]+(?:[.,][0-9]+)?/) ?? [''])[0].replace(',', '.');
  assert.ok(n === '3' || n === '3.3', `the dry total is 3 or 3.3, not ${n}`);
});

test('part PAN-26', () => {
  const plan = path.join(ROOT, 'docs', 'shelves.md');
  assert.ok(fs.existsSync(plan) && fs.readFileSync(plan, 'utf8').trim() !== '', 'the plan in docs/shelves.md');
  const file = stockFile(['rice;dry;2;kg;;B3', 'rice;dry;5;kg;2028-01-01;C1', 'beans;canned;3;pcs;2027-09-01']);
  const where = pantry('where', file, ['rice']);
  assert.equal(where.status, 0, where.err);
  assert.ok(has(where.out, 'B3') && has(where.out, 'C1'), `the shelves of rice:\n${where.out}`);
  const list = pantry('list', file);
  assert.equal(list.status, 0, list.err);
  assert.ok(has(list.out, 'beans'), 'a five-field line still lists');
  assert.ok(list.out.split('\n').some((l) => has(l, 'rice') && has(l, 'B3')), `list shows the shelf:\n${list.out}`);
});

test('part PAN-27', () => {
  const file = stockFile(['apples;produce;1;kg;', 'carrots;produce;500;g;', 'pears;produce;2;kilo;', 'beets;produce;500;gr;', 'oil;dry;1;l;', 'oil;dry;500;ml;', 'oil;dry;1;ltr;']);
  const r = pantry('report', file);
  assert.equal(r.status, 0, r.err);
  const total = (category, unit, expected) => {
    const lines = r.out.split('\n').filter((l) => has(l, category));
    assert.equal(lines.length, 1, `one total for ${category}:\n${r.out}`);
    assert.ok(has(lines[0], unit), `${category} in ${unit}: ${lines[0]}`);
    const n = Number((lines[0].match(/[0-9]+(?:[.,][0-9]+)?/) ?? ['NaN'])[0].replace(',', '.'));
    assert.ok(Math.abs(n - expected) <= 0.5, `${category}: ${n} for ${expected}`);
  };
  total('produce', 'kg', 4);
  total('dry', 'l', 2.5);
});

test('part PAN-29', () => {
  // Whatever window a category has, a batch due tomorrow is listed and one that expired yesterday is not (PAN-24 leaves the windows open).
  const file = stockFile(['milk;dairy;6;l;2027-01-11', 'rice;dry;25;kg;2027-01-09', 'cream;dairy;1;l;']);
  const json = (command, rest) => {
    const r = pantry(command, file, rest);
    assert.equal(r.status, 0, r.err);
    const value = JSON.parse(r.out.trim());
    assert.ok(Array.isArray(value), `${command} prints an array`);
    assert.ok(value.every((it) => it && typeof it === 'object' && typeof it.name === 'string'), `${command}: objects with the name`);
    return value.map((it) => it.name).sort();
  };
  assert.deepEqual(json('list', ['--json']), ['cream', 'milk', 'rice']);
  assert.deepEqual(json('expiring', ['--today', '2027-01-10', '--json']), ['milk']);
  assert.deepEqual(json('low', ['--json']), ['cream']);
});

test('part PAN-30', () => {
  const start = 'rice;dry;25;kg;\n';
  for (const [args, bad] of [
    [['beans', 'canned', '-2', 'pcs'], '-2'],
    [['beans', 'canned', 'abc', 'pcs'], 'abc'],
    [['beans', 'gadgets', '2', 'pcs'], 'gadgets'],
  ]) {
    const file = stockFile(['rice;dry;25;kg;']);
    const r = pantry('add', file, args);
    assert.notEqual(r.status, 0, `add ${args.join(' ')} is refused`);
    assert.ok(r.all.includes(bad), `the message names ${bad}: ${r.all}`);
    assert.equal(fs.readFileSync(file, 'utf8'), start, 'nothing is written');
  }
  const file = stockFile(['rice;dry;25;kg;']);
  const ok = pantry('add', file, ['beans', 'canned', '2', 'pcs', '2027-09-01']);
  assert.equal(ok.status, 0, ok.err);
  assert.ok(has(fs.readFileSync(file, 'utf8'), 'beans'), 'a good batch is still added');
});

/** Every name a renamed option of `low` could have: the options the code and the documents name, and common words for a threshold. */
function optionCandidates() {
  const files = [];
  const walk = (dir, ext) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, ext);
      else if (ext.some((x) => e.name.endsWith(x))) files.push(full);
    }
  };
  walk(path.join(ROOT, 'src'), ['.js']);
  walk(path.join(ROOT, 'bin'), ['.js']);
  walk(path.join(ROOT, 'docs'), ['.md']);
  for (const f of ['README.md', 'TICKETS.md']) if (fs.existsSync(path.join(ROOT, f))) files.push(path.join(ROOT, f));
  // The names written as options come first, then common words for a threshold, then the names the
  // code reads from an object or declares as a key, where an option's name can also be.
  const written = new Set();
  const common = ['threshold', 'below', 'under', 'less-than', 'lt', 'max', 'limit', 'min-qty', 'min-quantity', 'minimum', 'qty', 'quantity', 'level', 'floor', 'at-least', 'min-stock', 'cutoff', 'reorder', 'reorder-level', 'fewer-than', 'less'];
  const read = new Set();
  const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  const builtin = /^(length|map|filter|forEach|push|join|split|slice|trim|replace|includes|startsWith|endsWith|sort|some|every|find|reduce|keys|values|entries|exports|log|error|exitCode|argv|stdout|stderr|write|env|cwd|parse|stringify|toFixed|test|match|readFileSync|writeFileSync|appendFileSync|existsSync|isArray|from|concat|indexOf|localeCompare|toLowerCase|toUpperCase|then|catch)$/;
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/--([a-z][a-z0-9-]*)/g)) written.add(m[1]);
    if (f.endsWith('.js'))
      for (const m of text.matchAll(/\.\s*([A-Za-z_$][\w$]*)|\[\s*['"]([A-Za-z][\w-]*)['"]\s*\]|['"]?([A-Za-z][\w-]*)['"]?\s*:/g)) {
        const name = m[1] ?? m[2] ?? m[3];
        if (name && !builtin.test(name)) {
          read.add(name);
          read.add(kebab(name));
        }
      }
  }
  const names = new Set([...written, ...common, ...read]);
  for (const known of ['min', 'json', 'category', 'today', 'help', 'version', 'days']) names.delete(known);
  return [...names].filter((n) => /^[a-z][a-z0-9-]*$/i.test(n) && n.length <= 30);
}

test('part PAN-32', () => {
  const file = stockFile(['a1;dry;1;kg;', 'b2;dry;2.5;kg;', 'c3;dry;5;kg;']);
  const names = (r) => ['a1', 'b2', 'c3'].filter((n) => has(r.out, n)).join(',');
  const byDefault = pantry('low', file);
  const withMin = pantry('low', file, ['--min', '3']);
  assert.equal(withMin.status, 0, withMin.err);
  assert.equal(names(byDefault), 'a1', 'the default threshold');
  assert.equal(names(withMin), 'a1,b2', '--min still works');
  const renamed = optionCandidates().find((n) => {
    const r = pantry('low', file, [`--${n}`, '3']);
    return r.status === 0 && names(r) === 'a1,b2';
  });
  assert.ok(renamed !== undefined, 'an option with another name works as --min does');
});

test('part PAN-33', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  for (const word of ['expiring', 'low', 'add']) assert.ok(has(readme, word), `the README describes ${word}`);
  assert.ok(readme.includes('--today'), 'the README describes --today');
});

test('part closing', () => {
  const lines = fs.readFileSync(path.join(ROOT, 'TICKETS.md'), 'utf8').split('\n');
  const start = lines.findIndex((l) => /^##\s+Done\b/i.test(l));
  assert.ok(start >= 0, 'a Done section');
  const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  const inDone = (i) => i > start && (end === -1 || i < end);
  const done = lines.filter((_, i) => inDone(i)).join('\n');
  const closed = ['PAN-21', 'PAN-22', 'PAN-23', 'PAN-24', 'PAN-25', 'PAN-26', 'PAN-27', 'PAN-29', 'PAN-30', 'PAN-31', 'PAN-32', 'PAN-33'];
  for (const id of closed) {
    assert.ok(has(done, id), `${id} is in Done`);
    assert.ok(!lines.some((l, i) => !inDone(i) && /^#{1,6}\s/.test(l) && has(l, id)), `${id} is no longer a ticket outside Done`);
  }
  assert.ok(!has(done, 'PAN-28'), 'the parked ticket is not in Done');
  assert.ok(lines.some((l, i) => !inDone(i) && /^#{1,6}\s/.test(l) && has(l, 'PAN-28')), 'the parked ticket stays open');
});
