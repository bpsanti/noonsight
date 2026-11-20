'use strict';

// The command line: pantry <command> <stock file> [options]

const fs = require('node:fs');
const { CATEGORIES } = require('./categories.js');
const { parseQty, parseStock } = require('./parse.js');
const { expiring, low, report } = require('./stock.js');

/** Positional arguments, and options as --name value, or --name alone for true. */
function parseArgs(argv) {
  const pos = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      pos.push(a);
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) opts[a.slice(2)] = true;
    else {
      opts[a.slice(2)] = next;
      i++;
    }
  }
  return { pos, opts };
}

function line(it) {
  return [it.name, it.category, it.qty, it.unit, it.expires ?? '', it.shelf ? `shelf ${it.shelf}` : ''].filter((s) => s !== '').join(' ');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Print batches as lines, or as one JSON array with --json. */
function print(items, opts, io) {
  if (opts.json) io.out(JSON.stringify(items));
  else for (const it of items) io.out(line(it));
}

const USAGE = 'usage: pantry <list|expiring|low|report|where|add> <stock file> [options]';

function add(file, [name, category, qty, unit, expires = ''], io) {
  const amount = parseQty(qty);
  if (Number.isNaN(amount) || amount < 0) {
    io.err(`the quantity "${qty}" is not a number of zero or more`);
    return 1;
  }
  if (!CATEGORIES.includes(category)) {
    io.err(`the category "${category}" is not one of ${CATEGORIES.join(', ')}`);
    return 1;
  }
  fs.appendFileSync(file, `${[name, category, qty, unit, expires].join(';')}\n`);
  io.out(`added ${name}`);
  return 0;
}

function run(argv, io) {
  const { pos, opts } = parseArgs(argv);
  const [command, file, ...rest] = pos;
  if (!command || !file) {
    io.err(USAGE);
    return 2;
  }
  if (command === 'add') return add(file, rest, io);
  const items = parseStock(fs.readFileSync(file, 'utf8'));
  if (command === 'list') {
    print(typeof opts.category === 'string' ? items.filter((it) => it.category === opts.category) : items, opts, io);
    return 0;
  }
  if (command === 'expiring') {
    print(expiring(items, typeof opts.today === 'string' ? opts.today : today()), opts, io);
    return 0;
  }
  if (command === 'low') {
    // --below is the option's name; --min, its old name, still works.
    const min = opts.below ?? opts.min;
    print(low(items, min === undefined ? undefined : Number(min)), opts, io);
    return 0;
  }
  if (command === 'report') {
    for (const l of report(items)) io.out(l);
    return 0;
  }
  if (command === 'where') {
    const [item] = rest;
    for (const it of items.filter((x) => x.name === item)) io.out(`${it.name} ${it.shelf ?? 'no shelf'}`);
    return 0;
  }
  io.err(`unknown command ${command}\n${USAGE}`);
  return 2;
}

module.exports = { parseArgs, run };
