// The command line, driven as a separate process with an isolated environment.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { FIXTURES, LAB_CONFIG, LAB_PRESETS, runCli, tempTree } from './helpers.js';
import { PACKAGE_ROOT } from '../src/config/paths.js';

const LAB_ENV = { NOONSIGHT_CONFIG: LAB_CONFIG, NOONSIGHT_PRESETS_DIR: LAB_PRESETS };
const NO_NETWORK = ['--require', path.join(FIXTURES, 'no-network.cjs')];

test('resolve prints the decision as JSON and exits 0 for each status', () => {
  const m = runCli(['resolve', 'claude-sonnet-5-5[1m]', 'investigate'], LAB_ENV);
  assert.equal(m.status, 0, m.stderr);
  const d = JSON.parse(m.stdout);
  assert.equal(d.status, 'matched');
  assert.equal(d.model, 'claude-sonnet-5-5');
  assert.equal(d.place, 'attended');
  assert.deepEqual(d.rules, ['sonnet/general', 'sonnet/investigate']);
  assert.match(d.text, /^<noonsight-rules model="claude-sonnet-5-5" scope="investigate">\n/);

  const n = runCli(['resolve', 'claude-opus-5-5'], LAB_ENV);
  assert.equal(n.status, 0, n.stderr);
  assert.equal(JSON.parse(n.stdout).status, 'none');

  const u = runCli(['resolve', 'claude-fable-5-2', '', 'subagent'], LAB_ENV);
  assert.equal(u.status, 0, u.stderr);
  assert.deepEqual(JSON.parse(u.stdout), {
    status: 'undeclared',
    scope: null,
    place: 'subagent',
    model: 'claude-fable-5-2',
    reason: 'no-entry',
    warning: 'noonsight: model claude-fable-5-2 has no declared rules (no-entry, subagent)',
  });

  const r = runCli(['resolve', ''], LAB_ENV);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).reason, 'model-not-reported');
});

test('resolve: scope and place are positional, as in noonsight resolve <model> [scope] [place]', () => {
  const r = runCli(['resolve', 'claude-sonnet-5-5', '', 'unattended'], LAB_ENV);
  assert.deepEqual(JSON.parse(r.stdout).rules, ['sonnet/general', 'sonnet/carry-through']);
  const both = JSON.parse(runCli(['resolve', 'claude-sonnet-5-5', 'investigate', 'subagent'], LAB_ENV).stdout);
  assert.equal(both.scope, 'investigate');
  assert.equal(both.place, 'subagent');
  assert.deepEqual(both.rules, ['sonnet/general', 'sonnet/investigate', 'sonnet/carry-through']);
  // "session", the earlier name of the place "attended", is still read, and the decision names the place by its name.
  const old = JSON.parse(runCli(['resolve', 'claude-sonnet-5-5', '', 'session'], LAB_ENV).stdout);
  assert.equal(old.place, 'attended');
  assert.deepEqual(old.rules, JSON.parse(runCli(['resolve', 'claude-sonnet-5-5', '', 'attended'], LAB_ENV).stdout).rules);
});

test('a refused configuration exits 2, prints its problems and no decision', () => {
  const dir = tempTree({ 'noonsight.json': { version: 1, models: { sonnet: { use: 'none' }, 'claude-x-*': { use: 'custom' } } } });
  const r = runCli(['resolve', 'claude-sonnet-5-5'], { NOONSIGHT_CONFIG: path.join(dir, 'noonsight.json') });
  assert.equal(r.status, 2);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /configuration refused/);
  assert.match(r.stderr, /\/models\/sonnet: key/);
  assert.match(r.stderr, /\/models\/claude-x-\*\/use: must be "none"/);
  assert.match(r.stderr, /Nothing from this configuration was applied\./);
});

test('usage errors exit 2 with the usage text', () => {
  for (const args of [[], ['nope'], ['resolve'], ['resolve', 'a', 'b', 'session', 'c'], ['resolve', 'a', 'b', 'office'], ['resolve', 'a', '--scope', 'b'], ['resolve', 'a', '--x']]) {
    const r = runCli(args, LAB_ENV);
    assert.equal(r.status, 2, `${JSON.stringify(args)}: ${r.stdout}`);
    assert.match(r.stderr, /usage: noonsight/);
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
  assert.match(rh.stdout, /resolve <model> \[scope\] \[attended\|unattended\|subagent\]/);
});

test('one configuration serves the whole machine: it never comes from a Claude Code config directory', () => {
  const machine = { version: 1, models: { 'claude-sonnet-5-5': { use: 'none' } } };
  const account = { version: 1, models: { 'claude-sonnet-5-5': { use: 'custom', add: [{ id: 'acct', file: 'a.md' }] } } };
  const home = tempTree({ '.config/noonsight/noonsight.json': machine });
  const claudeDir = tempTree({ 'noonsight.json': account, 'noonsight/noonsight.json': account, 'a.md': 'ACCOUNT' });
  const viaHome = runCli(['resolve', 'claude-sonnet-5-5'], { HOME: home, CLAUDE_CONFIG_DIR: claudeDir });
  assert.equal(JSON.parse(viaHome.stdout).status, 'none', viaHome.stderr);

  const explicit = runCli(['resolve', 'claude-sonnet-5-5'], { HOME: home, CLAUDE_CONFIG_DIR: claudeDir, ...LAB_ENV });
  assert.equal(JSON.parse(explicit.stdout).status, 'matched');
});

test('with no configuration anywhere, resolve says where it looked', () => {
  const home = tempTree({});
  const r = runCli(['resolve', 'claude-sonnet-5-5'], { HOME: home });
  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes(path.join(home, '.config', 'noonsight', 'noonsight.json')), r.stderr);
  assert.match(r.stderr, /no configuration file here/);
});

test('the network guard used below does stop a connection attempt', () => {
  const r = runCli(['--version'], {}, [...NO_NETWORK, '--eval', "require('node:net').connect(9, '127.0.0.1')", '--']);
  assert.equal(r.status, 97);
  assert.match(r.stderr, /NETWORK-ATTEMPT/);
});

test('resolve never touches the network', () => {
  for (const args of [
    ['resolve', 'claude-sonnet-5-5', 'investigate', 'subagent'],
    ['resolve', 'claude-opus-5-5'],
    ['resolve', 'claude-fable-5-2'],
  ]) {
    const r = runCli(args, LAB_ENV, NO_NETWORK);
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stderr, /NETWORK-ATTEMPT/);
  }
  const dir = tempTree({ 'noonsight.json': { version: 7 } });
  const refused = runCli(['resolve', 'x-1'], { NOONSIGHT_CONFIG: path.join(dir, 'noonsight.json') }, NO_NETWORK);
  assert.equal(refused.status, 2);
  assert.doesNotMatch(refused.stderr, /NETWORK-ATTEMPT/);
});
