'use strict';

// The units of the stock, and how much of its base unit (kg, l or pcs) one of each is, with the other
// ways the donation sheets write them, from data/unit-aliases.txt.

const fs = require('node:fs');
const path = require('node:path');

const UNITS = {
  kg: { base: 'kg', factor: 1 },
  g: { base: 'kg', factor: 0.001 },
  l: { base: 'l', factor: 1 },
  ml: { base: 'l', factor: 0.001 },
  pcs: { base: 'pcs', factor: 1 },
};

/** Alias to unit, from the aliases file. */
const ALIASES = Object.fromEntries(
  fs
    .readFileSync(path.join(__dirname, '..', 'data', 'unit-aliases.txt'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=').map((s) => s.trim().toLowerCase())),
);

/** The unit a written unit stands for, whatever its case or spelling. */
function unitOf(written) {
  const u = String(written ?? '').trim().toLowerCase();
  return ALIASES[u] ?? u;
}

/** The quantity in the base unit of its unit; a unit it does not know is left as it is. */
function toBase(qty, unit) {
  const u = UNITS[unitOf(unit)];
  if (!u) return { qty, unit };
  return { qty: qty * u.factor, unit: u.base };
}

module.exports = { UNITS, toBase, unitOf };
