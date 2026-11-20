// The hidden check of the feature task: copied into the project only after the run ends.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { main } from '../src/cli.js';
import { quote } from '../src/quote.js';

const namesZone4 = /zone\D*4|\b4\b.*zone/i;

function run(argv) {
  const out = [];
  const err = [];
  const code = main(argv, (l) => out.push(String(l)), (l) => err.push(String(l)));
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('express costs twice the standard price in zones 1 to 3', () => {
  assert.equal(quote({ weightKg: 3, zone: 2, express: true }).price, '20.00');
  assert.equal(quote({ weightKg: 2.5, zone: 1, express: true }).price, '15.20');
  assert.equal(quote({ weightKg: 1, zone: 3, express: true }).price, '18.20');
});

test('the standard price does not change', () => {
  assert.equal(quote({ weightKg: 3, zone: 2 }).price, '10.00');
  assert.equal(quote({ weightKg: 3, zone: 2, express: false }).price, '10.00');
  assert.equal(quote({ weightKg: 1, zone: 4 }).price, '15.40');
});

test('zone 4 has no express service, and the error names the zone', () => {
  assert.throws(() => quote({ weightKg: 1, zone: 4, express: true }), namesZone4);
});

test('the command line takes --express anywhere among its flags', () => {
  for (const argv of [
    ['--weight', '3', '--zone', '2', '--express'],
    ['--express', '--weight', '3', '--zone', '2'],
  ]) {
    const r = run(argv);
    assert.equal(r.code, 0, `${argv.join(' ')}: ${r.err}`);
    assert.match(r.out, /20\.00/);
  }
  const standard = run(['--weight', '3', '--zone', '2']);
  assert.equal(standard.code, 0);
  assert.match(standard.out, /10\.00/);
});

test('the command line refuses express in zone 4, naming the zone', () => {
  const r = run(['--weight', '1', '--zone', '4', '--express']);
  assert.notEqual(r.code, 0);
  assert.match(`${r.err}\n${r.out}`, namesZone4);
});

test('the README documents the flag', () => {
  assert.match(fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8'), /--express/);
});
