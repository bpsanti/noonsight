'use strict';

// The command line: pantry <command> <stock file> [options]

const fs = require('node:fs');
const { parseStock } = require('./parse.js');
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
  return [it.name, it.category, it.qty, it.unit, it.expires ?? ''].join(' ').trim();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const USAGE = 'usage: pantry <list|expiring|low|report|add> <stock file> [options]';

function run(argv, io) {
  const { pos, opts } = parseArgs(argv);
  const [command, file, ...rest] = pos;
  if (!command || !file) {
    io.err(USAGE);
    return 2;
  }
  if (command === 'add') {
    const [name, category, qty, unit, expires = ''] = rest;
    fs.appendFileSync(file, `${[name, category, qty, unit, expires].join(';')}\n`);
    io.out(`added ${name}`);
    return 0;
  }
  const items = parseStock(fs.readFileSync(file, 'utf8'));
  if (command === 'list') {
    for (const it of items) io.out(line(it));
    return 0;
  }
  if (command === 'expiring') {
    for (const it of expiring(items, opts.today ?? today())) io.out(line(it));
    return 0;
  }
  if (command === 'low') {
    for (const it of low(items, opts.min === undefined ? undefined : Number(opts.min))) io.out(line(it));
    return 0;
  }
  if (command === 'report') {
    for (const l of report(items)) io.out(l);
    return 0;
  }
  io.err(`unknown command ${command}\n${USAGE}`);
  return 2;
}

module.exports = { parseArgs, run };
