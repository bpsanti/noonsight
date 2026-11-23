// One claim per event occurrence (src/state/claims.ts): with two installs, each event runs once.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { claimOccurrence, type Occurrence } from '../src/state/claims.js';
import type { InstallKind } from '../src/state/installs.js';
import { pruneState } from '../src/state/sessions.js';
import { hookHome, hookInput, LAB_CONFIG, LAB_PRESETS, NO_NETWORK, runCli, tempTree, CLI } from './helpers.js';

const START: Occurrence = { event: 'session-start', parentPid: 100, input: '{"session_id":"s"}' };
const T = 1_800_000_000_000;

test('the first kind to claim an occurrence runs it, and another kind does not', () => {
  const dir = tempTree({});
  assert.equal(claimOccurrence(dir, 'plugin', START, T), true);
  assert.equal(claimOccurrence(dir, 'account', START, T + 5), false);
  assert.equal(claimOccurrence(dir, 'managed', START, T + 9), false);
});

test('the same kind seeing the same input again runs it: it is a new occurrence, and the other kind still does not', () => {
  const dir = tempTree({});
  assert.equal(claimOccurrence(dir, 'account', START, T), true);
  assert.equal(claimOccurrence(dir, 'plugin', START, T + 1), false);
  // The second occurrence, the plugin first.
  assert.equal(claimOccurrence(dir, 'plugin', START, T + 30_000), false);
  assert.equal(claimOccurrence(dir, 'account', START, T + 30_001), true);
  assert.equal(claimOccurrence(dir, 'plugin', START, T + 70_000), false, 'claiming again renews the claim');
});

test('a claim older than the window, or from a clock that was set back, is no claim', () => {
  const dir = tempTree({});
  assert.equal(claimOccurrence(dir, 'account', START, T), true);
  assert.equal(claimOccurrence(dir, 'plugin', START, T + 60_000), true);
  assert.equal(claimOccurrence(dir, 'account', START, T - 3_600_000), true);
});

test('another event, another input or another Claude Code process is another occurrence', () => {
  const dir = tempTree({});
  assert.equal(claimOccurrence(dir, 'account', START, T), true);
  assert.equal(claimOccurrence(dir, 'plugin', { ...START, event: 'model-switch' }, T), true);
  assert.equal(claimOccurrence(dir, 'plugin', { ...START, input: '{"session_id":"t"}' }, T), true);
  assert.equal(claimOccurrence(dir, 'plugin', { ...START, parentPid: 101 }, T), true);
});

test('a claim that cannot be read, written or locked runs the hook', () => {
  const dir = tempTree({});
  assert.equal(claimOccurrence(dir, 'account', START, T), true);
  const claims = path.join(dir, 'claims');
  const file = path.join(claims, fs.readdirSync(claims)[0] ?? '');
  fs.writeFileSync(file, 'not json');
  assert.equal(claimOccurrence(dir, 'plugin', START, T), true, 'an unreadable claim');
  fs.writeFileSync(file.replace(/json$/, 'lock'), '');
  assert.equal(claimOccurrence(dir, 'account', START, T), true, 'a lock another copy holds');
  const blocked = tempTree({ claims: 'a file where the directory goes' });
  assert.equal(claimOccurrence(blocked, 'account', START, T), true);
  assert.equal(claimOccurrence(blocked, 'plugin', START, T), true);
});

test('a lock left by a copy that was stopped is taken over', () => {
  const dir = tempTree({});
  assert.equal(claimOccurrence(dir, 'account', START, T), true);
  const claims = path.join(dir, 'claims');
  const lock = path.join(claims, (fs.readdirSync(claims)[0] ?? '').replace(/json$/, 'lock'));
  fs.writeFileSync(lock, '');
  fs.utimesSync(lock, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));
  assert.equal(claimOccurrence(dir, 'plugin', START, T), false);
  assert.equal(fs.existsSync(lock), false);
});

test('claims are removed with the other records', () => {
  const dir = tempTree({});
  claimOccurrence(dir, 'account', START, T);
  const claims = path.join(dir, 'claims');
  pruneState(dir, Date.now());
  assert.equal(fs.readdirSync(claims).length, 1);
  pruneState(dir, Date.now() + 2 * 24 * 60 * 60 * 1000);
  assert.equal(fs.readdirSync(claims).length, 0);
});

/** Hook processes of every kind, started together by this process as Claude Code starts its copies. */
async function together(kinds: readonly InstallKind[], env: Record<string, string>, input: string): Promise<string[]> {
  return Promise.all(
    kinds.map(
      (kind) =>
        new Promise<string>((done) => {
          const c = spawn(process.execPath, [...NO_NETWORK, CLI, 'hook', '--install', kind, 'session-start'], { env: { PATH: process.env.PATH ?? '', ...env }, stdio: ['pipe', 'pipe', 'ignore'] });
          let out = '';
          c.stdout.on('data', (d: Buffer) => (out += d.toString()));
          c.on('close', () => done(out));
          c.stdin.end(input);
        }),
    ),
  );
}

test('copies of two and three kinds started at once on identical input: exactly one delivers and logs', async () => {
  const h = hookHome();
  for (let i = 0; i < 12; i++) {
    const kinds: InstallKind[] = i % 2 ? ['account', 'plugin'] : ['plugin', 'managed', 'account'];
    const outs = await together(kinds, h.env, hookInput('session-start-startup', { session_id: `claim-${i}` }));
    assert.equal(outs.filter((o) => o !== '').length, 1, `round ${i}: ${JSON.stringify(outs.map((o) => o.length))}`);
  }
  assert.equal(h.log().length, 12);
});

test('a copy that does nothing leaves the event to the other install', () => {
  // NOONSIGHT_DISABLE, and an account install with no configuration, claim nothing.
  const home = tempTree({});
  const env = { HOME: home, NOONSIGHT_PRESETS_DIR: LAB_PRESETS, NOONSIGHT_SYSTEM_ROOT: tempTree({}), NOONSIGHT_CONFIG: LAB_CONFIG };
  const input = hookInput('session-start-startup');
  assert.equal(runCli(['hook', '--install', 'account', 'session-start'], { ...env, NOONSIGHT_DISABLE: '1' }, NO_NETWORK, input).stdout, '');
  assert.notEqual(runCli(['hook', '--install', 'plugin', 'session-start'], env, NO_NETWORK, input).stdout, '');
});

test('a hook run by hand, with no install kind, makes no claim', () => {
  const h = hookHome();
  assert.notEqual(h.hook('session-start', hookInput('session-start-startup')).raw, '');
  assert.equal(fs.existsSync(path.join(h.dir, '.local', 'state', 'noonsight', 'claims')), false);
});
