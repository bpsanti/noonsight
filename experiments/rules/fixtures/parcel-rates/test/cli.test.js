import assert from 'node:assert/strict';
import test from 'node:test';
import { main } from '../src/cli.js';

function run(argv) {
  const out = [];
  const err = [];
  const code = main(argv, (l) => out.push(l), (l) => err.push(l));
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('the command line prints the price', () => {
  assert.deepEqual(run(['--weight', '3', '--zone', '2']), { code: 0, out: 'Zone 2, 3 kg: 10.00', err: '' });
});

test('a bad zone fails with its reason', () => {
  const r = run(['--weight', '3', '--zone', '9']);
  assert.equal(r.code, 1);
  assert.match(r.err, /unknown zone: 9/);
});
