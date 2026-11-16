// sextant init and sextant models, driven as separate processes with an isolated home directory.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { loadConfig } from '../src/config/load.js';
import { FIXTURES, LAB_PRESETS, runCli, tempTree } from './helpers.js';

const NO_NETWORK = ['--require', path.join(FIXTURES, 'no-network.cjs')];

function log(home: string, records: readonly Record<string, unknown>[], file = 'decisions.jsonl'): void {
  const dir = path.join(home, '.local', 'state', 'sextant');
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, file), records.map((r) => `${JSON.stringify(r)}\n`).join(''));
}

test('init writes a configuration that declares every preset model with "use": "preset", and it loads', () => {
  const home = tempTree({});
  const r = runCli(['init'], { HOME: home }, NO_NETWORK);
  assert.equal(r.status, 0, r.stderr);
  const file = path.join(home, '.config', 'sextant', 'sextant.json');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {
    $schema: 'https://unpkg.com/sextant-ai@0/schema/sextant.schema.json',
    version: 1,
    preset: 'claude',
    models: {
      'claude-fable-5-2': { use: 'preset' },
      'claude-opus-5-5': { use: 'preset' },
      'claude-sonnet-5-5': { use: 'preset' },
      'claude-haiku-5-5': { use: 'preset' },
    },
  });
  assert.equal(
    r.stdout,
    `wrote ${file}: preset claude 1.2.0, 4 models declared with "use": "preset"\n` +
      '  claude-fable-5-2: 2 of 4 rules on\n' +
      '  claude-opus-5-5: 1 of 3 rules on\n' +
      '  claude-sonnet-5-5: 3 of 6 rules on\n' +
      '  claude-haiku-5-5: 2 of 3 rules on\n' +
      'Next: `sextant models` lists every rule with its source, effect and cost; `sextant install` adds the hooks; `sextant check` checks it all.\n',
  );
  assert.equal(loadConfig(file).exact.size, 4);
  assert.doesNotMatch(r.stderr, /NETWORK-ATTEMPT/);
});

test('init writes to SEXTANT_CONFIG and never replaces an existing file', () => {
  const dir = tempTree({ 'mine.json': '{"keep": true}' });
  const existing = runCli(['init'], { SEXTANT_CONFIG: path.join(dir, 'mine.json') });
  assert.equal(existing.status, 1);
  assert.match(existing.stderr, /mine\.json already exists, and init never replaces it/);
  assert.equal(fs.readFileSync(path.join(dir, 'mine.json'), 'utf8'), '{"keep": true}');

  const fresh = runCli(['init'], { SEXTANT_CONFIG: path.join(dir, 'nested', 'new.json') });
  assert.equal(fresh.status, 0, fresh.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'nested', 'new.json')));
});

test('init refuses arguments, and a preset that is not installed', () => {
  const usage = runCli(['init', '--force'], { HOME: tempTree({}) });
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /usage: sextant init/);
  const missing = runCli(['init'], { HOME: tempTree({}), SEXTANT_PRESETS_DIR: LAB_PRESETS });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /preset "claude" is not installed/);
});

test('models lists each declared model with its rules on and off, their source, effect and cost, and the user\'s own rules', () => {
  const home = tempTree({});
  const config = tempTree({
    'sextant.json': {
      version: 1,
      models: {
        'claude-sonnet-5-5': { use: 'preset', enable: ['sonnet-5-5/ideas-first'], disable: ['sonnet-5-5/stay-in-scope'], add: [{ id: 'team/style', file: 'style.md', scopes: ['routine'] }] },
        'claude-haiku-5-5': { use: 'custom', add: [{ id: 'team/haiku', file: 'style.md', where: ['subagent'] }] },
        'claude-opus-5-5': { use: 'none' },
        'claude-opus-4-*': { use: 'none' },
      },
    },
    'style.md': 'Commits use the imperative mood.',
  });
  log(home, [
    { ts: '2026-11-16T10:00:00.000Z', event: 'session-start', model: 'claude-sonnet-5-5', status: 'matched' },
    { ts: '2026-11-16T11:00:00.000Z', event: 'agent-call', model: 'claude-sonnet-5-5', status: 'matched' },
    { ts: '2026-11-16T12:00:00.000Z', event: 'session-start', model: 'claude-opus-4-1', status: 'none' },
    { ts: '2026-11-16T13:00:00.000Z', event: 'session-start', model: 'claude-fable-5-2', status: 'undeclared' },
    { ts: '2026-11-16T14:00:00.000Z', event: 'session-start', model: 'claude-fable-5-3', status: 'undeclared' },
    { ts: '2026-11-16T15:00:00.000Z', event: 'session-start', model: null, status: 'undeclared' },
  ]);
  fs.appendFileSync(path.join(home, '.local', 'state', 'sextant', 'decisions.jsonl'), '{"torn\n');
  log(home, [{ ts: '2026-11-15T09:00:00.000Z', event: 'session-start', model: 'claude-sonnet-5-5', status: 'matched' }], 'decisions.1.jsonl');
  const env = { HOME: home, SEXTANT_CONFIG: path.join(config, 'sextant.json') };

  const r = runCli(['models'], env, NO_NETWORK);
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout;
  assert.match(out, /^preset claude 1\.2\.0: its rules were compared with the system prompts of Claude Code 2\.1\.325 on \d{4}-\d{2}-\d{2}/m);
  assert.match(out, /^claude-sonnet-5-5: preset, 4 of 7 rules on; seen in 3 decisions, last 2026-11-16T11:00:00\.000Z$/m);
  assert.match(out, /^ {2}on {3}sonnet-5-5\/carry-through {2}\(scopes: every scope; places: unattended, subagent\)$/m);
  assert.match(out, /^ {2}off {2}sonnet-5-5\/stay-in-scope {2}\(scopes: routine; places: session, unattended, subagent\)$/m);
  assert.match(out, /^ {2}on {3}sonnet-5-5\/ideas-first {2}\(scopes: every scope; places: session\)$/m);
  assert.match(out, /^ {7}source: https:\/\/platform\.claude\.com\/docs\/en\/build-with-claude\/prompt-engineering\/prompting-claude-sonnet-5-5, "Verification on coding tasks", read \d{4}-\d{2}-\d{2}$/m);
  assert.match(out, /^ {7}cost: Slightly higher cost per task\.$/m);
  assert.match(out, /^ {2}on {3}team\/style {2}\(scopes: routine; places: session, unattended, subagent\)\n {7}file: style\.md$/m);
  assert.match(out, /^claude-haiku-5-5: custom, 1 rule; not seen in the decision log\n {2}on {3}team\/haiku {2}\(scopes: every scope; places: subagent\)$/m);
  assert.match(out, /^claude-opus-5-5: none, by decision; not seen in the decision log$/m);
  assert.match(out, /^claude-opus-4-\*: none, a wildcard; covers claude-opus-4-1 \(1 decision\) from the decision log$/m);
  assert.match(out, /^In the preset, not declared \(add an entry with "use": "preset" to receive these rules\):\n {2}claude-fable-5-2: 4 rules, 2 on by default$/m);
  assert.match(out, /^ {2}claude-fable-5-2: seen in 1 decision, last 2026-11-16T13:00:00\.000Z; the preset has rules for it \("use": "preset"\)$/m);
  assert.match(out, /^ {2}claude-fable-5-3: seen in 1 decision, last 2026-11-16T14:00:00\.000Z; the preset has no rules for it/m);
  assert.doesNotMatch(r.stderr, /NETWORK-ATTEMPT/);

  const j = runCli(['models', '--json'], env);
  assert.equal(j.status, 0, j.stderr);
  const report = JSON.parse(j.stdout);
  assert.equal(report.preset.claude_code.version, '2.1.325');
  const sonnet = report.declared.find((m: any) => m.key === 'claude-sonnet-5-5');
  assert.deepEqual(sonnet.seen, { decisions: 3, last: '2026-11-16T11:00:00.000Z' });
  assert.deepEqual(
    sonnet.rules.map((x: any) => [x.id, x.origin, x.on]),
    [
      ['sonnet-5-5/carry-through', 'preset', true],
      ['sonnet-5-5/stay-in-scope', 'preset', false],
      ['sonnet-5-5/verify-changes', 'preset', true],
      ['sonnet-5-5/no-self-review-rounds', 'preset', false],
      ['sonnet-5-5/ideas-first', 'preset', true],
      ['sonnet-5-5/check-current-facts', 'preset', false],
      ['team/style', 'user', true],
    ],
  );
  assert.deepEqual(report.preset_undeclared, [{ key: 'claude-fable-5-2', rules: 4, on_by_default: 2 }]);
  assert.deepEqual(
    report.seen_undeclared.map((s: any) => [s.model, s.in_preset]),
    [
      ['claude-fable-5-2', true],
      ['claude-fable-5-3', false],
    ],
  );
});

test('models with no preset installed, no log, and a refused configuration', () => {
  const config = tempTree({ 'sextant.json': { version: 1, models: { 'claude-haiku-5-5': { use: 'none' } } } });
  const r = runCli(['models'], { SEXTANT_CONFIG: path.join(config, 'sextant.json'), SEXTANT_PRESETS_DIR: tempTree({}) });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^preset: not installed$/m);
  assert.match(r.stdout, /^claude-haiku-5-5: none, by decision; not seen in the decision log$/m);
  assert.doesNotMatch(r.stdout, /not declared/);

  const bad = tempTree({ 'sextant.json': { version: 1, models: { sonnet: { use: 'none' } } } });
  const refused = runCli(['models'], { SEXTANT_CONFIG: path.join(bad, 'sextant.json') });
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /configuration refused/);
  assert.equal(refused.stdout, '');

  const usage = runCli(['models', 'x'], {});
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /usage: sextant models \[--json\]/);
});
