// The command line, driven as a separate process with an isolated environment.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { FIXTURES, LAB_CONFIG, LAB_PRESETS, runCli, tempTree } from './helpers.js';
import { PACKAGE_ROOT } from '../src/config/paths.js';

const LAB_ENV = { SEXTANT_CONFIG: LAB_CONFIG, SEXTANT_PRESETS_DIR: LAB_PRESETS };
const NO_NETWORK = ['--require', path.join(FIXTURES, 'no-network.cjs')];

test('resolve prints the decision as JSON and exits 0 for each status', () => {
  const m = runCli(['resolve', 'claude-sonnet-5-5[1m]', '--scope', 'investigate'], LAB_ENV);
  assert.equal(m.status, 0, m.stderr);
  const d = JSON.parse(m.stdout);
  assert.equal(d.status, 'matched');
  assert.equal(d.model, 'claude-sonnet-5-5');
  assert.equal(d.place, 'session');
  assert.deepEqual(d.rules, ['sonnet/general', 'sonnet/investigate']);
  assert.match(d.text, /^<sextant-rules model="claude-sonnet-5-5" scope="investigate">\n/);

  const n = runCli(['resolve', 'claude-opus-5-5'], LAB_ENV);
  assert.equal(n.status, 0, n.stderr);
  assert.equal(JSON.parse(n.stdout).status, 'none');

  const u = runCli(['resolve', 'claude-fable-5-2', '--place=subagent'], LAB_ENV);
  assert.equal(u.status, 0, u.stderr);
  assert.deepEqual(JSON.parse(u.stdout), {
    status: 'undeclared',
    scope: null,
    place: 'subagent',
    model: 'claude-fable-5-2',
    reason: 'no-entry',
    warning: 'sextant: model claude-fable-5-2 has no declared rules (no-entry, subagent)',
  });

  const r = runCli(['resolve', ''], LAB_ENV);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).reason, 'model-not-reported');
});

test('resolve: --place selects the place rules', () => {
  const r = runCli(['resolve', 'claude-sonnet-5-5', '--place', 'unattended'], LAB_ENV);
  assert.deepEqual(JSON.parse(r.stdout).rules, ['sonnet/general', 'sonnet/carry-through']);
});

test('a refused configuration exits 2, prints every problem and no decision', () => {
  const dir = tempTree({ 'sextant.json': { version: 1, models: { sonnet: { use: 'none' }, 'claude-x-*': { use: 'custom' } } } });
  const r = runCli(['resolve', 'claude-sonnet-5-5'], { SEXTANT_CONFIG: path.join(dir, 'sextant.json') });
  assert.equal(r.status, 2);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /configuration refused/);
  assert.match(r.stderr, /\/models\/sonnet: key/);
  assert.match(r.stderr, /\/models\/claude-x-\*\/use: must be "none"/);
  assert.match(r.stderr, /Nothing from this configuration was applied\./);
});

test('usage errors exit 2 with the usage text', () => {
  for (const args of [[], ['nope'], ['resolve'], ['resolve', 'a', 'b'], ['resolve', 'a', '--place', 'office'], ['resolve', 'a', '--scope'], ['resolve', 'a', '--x']]) {
    const r = runCli(args, LAB_ENV);
    assert.equal(r.status, 2, `${JSON.stringify(args)}: ${r.stdout}`);
    assert.match(r.stderr, /usage: sextant/);
    assert.equal(r.stdout, '');
  }
});

test('--version prints only the package version, --help the usage', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  const v = runCli(['--version']);
  assert.equal(v.status, 0);
  assert.equal(v.stdout, `${pkg.version}\n`);
  assert.match(v.stdout, /^\d+\.\d+\.\d+\n$/);
  const h = runCli(['--help']);
  assert.equal(h.status, 0);
  assert.match(h.stdout, /resolve <model>/);
  const rh = runCli(['resolve', '--help']);
  assert.equal(rh.status, 0);
  assert.match(rh.stdout, /--place session\|unattended\|subagent/);
});

test('one configuration serves the whole machine: it never comes from a Claude Code config directory', () => {
  const machine = { version: 1, models: { 'claude-sonnet-5-5': { use: 'none' } } };
  const account = { version: 1, models: { 'claude-sonnet-5-5': { use: 'custom', add: [{ id: 'acct', file: 'a.md' }] } } };
  const home = tempTree({ '.config/sextant/sextant.json': machine });
  const claudeDir = tempTree({ 'sextant.json': account, 'sextant/sextant.json': account, 'a.md': 'ACCOUNT' });
  const viaHome = runCli(['resolve', 'claude-sonnet-5-5'], { HOME: home, CLAUDE_CONFIG_DIR: claudeDir });
  assert.equal(JSON.parse(viaHome.stdout).status, 'none', viaHome.stderr);

  const xdg = tempTree({ 'sextant/sextant.json': { version: 1, models: { 'claude-sonnet-5-5': { use: 'custom', add: [{ id: 'x', file: 'x.md' }] } } }, 'sextant/x.md': 'XDG-RULE' });
  const viaXdg = runCli(['resolve', 'claude-sonnet-5-5'], { HOME: home, XDG_CONFIG_HOME: xdg, CLAUDE_CONFIG_DIR: claudeDir });
  assert.match(JSON.parse(viaXdg.stdout).text, /XDG-RULE/);

  const relativeXdg = runCli(['resolve', 'claude-sonnet-5-5'], { HOME: home, XDG_CONFIG_HOME: 'relative/dir' });
  assert.equal(JSON.parse(relativeXdg.stdout).status, 'none', 'a relative XDG_CONFIG_HOME is ignored, as the XDG specification says');

  const explicit = runCli(['resolve', 'claude-sonnet-5-5'], { HOME: home, XDG_CONFIG_HOME: xdg, ...LAB_ENV });
  assert.equal(JSON.parse(explicit.stdout).status, 'matched');
});

test('with no configuration anywhere, resolve says where it looked', () => {
  const home = tempTree({});
  const r = runCli(['resolve', 'claude-sonnet-5-5'], { HOME: home });
  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes(path.join(home, '.config', 'sextant', 'sextant.json')), r.stderr);
  assert.match(r.stderr, /no configuration file here/);
});

test('the network guard used below does stop a connection attempt', () => {
  const r = runCli(['--version'], {}, [...NO_NETWORK, '--eval', "require('node:net').connect(9, '127.0.0.1')", '--']);
  assert.equal(r.status, 97);
  assert.match(r.stderr, /NETWORK-ATTEMPT/);
});

test('resolve never touches the network', () => {
  for (const args of [
    ['resolve', 'claude-sonnet-5-5', '--scope', 'investigate', '--place', 'subagent'],
    ['resolve', 'claude-opus-5-5'],
    ['resolve', 'claude-fable-5-2'],
  ]) {
    const r = runCli(args, LAB_ENV, NO_NETWORK);
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stderr, /NETWORK-ATTEMPT/);
  }
  const dir = tempTree({ 'sextant.json': { version: 7 } });
  const refused = runCli(['resolve', 'x-1'], { SEXTANT_CONFIG: path.join(dir, 'sextant.json') }, NO_NETWORK);
  assert.equal(refused.status, 2);
  assert.doesNotMatch(refused.stderr, /NETWORK-ATTEMPT/);
});
