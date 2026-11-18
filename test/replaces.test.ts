// A user rule that replaces a preset rule: the preset rule is off, and the user rule is delivered in
// its place, with its scopes, places and triggers unless it gives its own. What the loader refuses,
// and how `noonsight models` and `noonsight check` show the pair.

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { ConfigError, loadConfig, loadConfigDetails } from '../src/config/load.js';
import { resolve } from '../src/core/resolve.js';
import type { Rule } from '../src/core/types.js';
import { LAB_PRESETS, labPresetWith, runCli, tempTree } from './helpers.js';

const SONNET = 'claude-sonnet-5-5';
const MINE = 'MY-CARRY-7310';
const INVESTIGATE = 'MY-INVESTIGATE-2284';

/** A configuration file next to the rule files the tests write; `config` overrides the defaults. */
function configTree(config: Record<string, unknown>): string {
  const dir = tempTree({
    'carry.md': `Finish what you start. ${MINE}`,
    'investigate.md': `State the hypothesis before reading code. ${INVESTIGATE}`,
    'team.md': 'Commits use the imperative mood. TEAM-COMMITS-4417',
    'noonsight.json': { version: 1, preset: 'lab', ...config },
  });
  return path.join(dir, 'noonsight.json');
}

function sonnet(entry: Record<string, unknown>, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...extra, models: { [SONNET]: { use: 'preset', ...entry } } };
}

function problemsOf(config: Record<string, unknown>, presetsDir = LAB_PRESETS): readonly string[] {
  try {
    loadConfig(configTree(config), { presetsDir });
  } catch (e) {
    if (e instanceof ConfigError) return e.problems;
    throw e;
  }
  assert.fail('the configuration was accepted');
}

function rulesOf(config: Record<string, unknown>, presetsDir = LAB_PRESETS): readonly Rule[] {
  const entry = loadConfig(configTree(config), { presetsDir }).exact.get(SONNET);
  assert.equal(entry?.use, 'rules');
  return entry?.use === 'rules' ? entry.rules : [];
}

const carry = { id: 'user/carry', file: 'carry.md', replaces: 'sonnet/carry-through' };
const team = { id: 'team/commits', file: 'team.md' };

test('the replaced rule is off, and the rule that replaces it is delivered in its place, with its scopes and places', () => {
  const config = sonnet({ add: [carry, { id: 'user/other', file: 'investigate.md' }] }, { all_models: { add: [team] } });
  const rules = rulesOf(config);
  assert.deepEqual(
    rules.map((r) => r.id),
    ['sonnet/general', 'sonnet/investigate', 'user/carry', 'team/commits', 'user/other'],
    'in the place of sonnet/carry-through, before the rules of all_models and the model\'s other rules',
  );
  const mine = rules.find((r) => r.id === 'user/carry');
  assert.deepEqual([mine?.origin, mine?.scopes, mine?.where, mine?.triggers, mine?.replaces], ['user', ['*'], ['unattended', 'subagent'], [], 'sonnet/carry-through']);

  const c = loadConfig(configTree(config), { presetsDir: LAB_PRESETS });
  const unattended = resolve(c, { model: SONNET, place: 'unattended' });
  assert.equal(unattended.status, 'matched');
  if (unattended.status !== 'matched') return;
  assert.deepEqual(unattended.rules, ['sonnet/general', 'user/carry', 'team/commits', 'user/other']);
  assert.match(unattended.text, new RegExp(MINE));
  assert.doesNotMatch(unattended.text, /SONNET-CARRY-4471/);
  // The places of the replaced rule: sonnet/carry-through is not for "session".
  const session = resolve(c, { model: SONNET, place: 'session' });
  assert.ok(session.status === 'matched' && !session.rules.includes('user/carry'));
});

test('a key the rule gives wins over the replaced rule\'s, and the others still come from it', () => {
  const rules = rulesOf(sonnet({ add: [{ id: 'user/investigate', file: 'investigate.md', replaces: 'sonnet/investigate', where: ['session'] }] }));
  const mine = rules.find((r) => r.id === 'user/investigate');
  assert.deepEqual([mine?.scopes, mine?.where], [['investigate'], ['session']]);
  assert.ok(!rules.some((r) => r.id === 'sonnet/investigate'));
  // A rule that ships off can be replaced too: the user rule is delivered in its place all the same.
  const off = rulesOf(sonnet({ add: [{ id: 'user/progress', file: 'carry.md', replaces: 'sonnet/progress-updates' }] }));
  assert.deepEqual(
    off.map((r) => [r.id, r.where.join(',')]),
    [
      ['sonnet/general', 'session,unattended,subagent'],
      ['sonnet/investigate', 'session,unattended,subagent'],
      ['sonnet/carry-through', 'unattended,subagent'],
      ['user/progress', 'session'],
    ],
  );
});

test('the rule takes the replaced rule\'s triggers too, unless it gives its own', () => {
  const presets = labPresetWith((p) => {
    const investigate = (p.models[SONNET].rules as Record<string, any>[]).find((r) => r.id === 'sonnet/investigate');
    if (investigate) investigate.triggers = ['code-edit'];
  });
  const replace = { id: 'user/investigate', file: 'investigate.md', replaces: 'sonnet/investigate' };
  const c = loadConfig(configTree(sonnet({ add: [replace] })), { presetsDir: presets });
  const edited = resolve(c, { model: SONNET, place: 'session', triggers: ['code-edit'] });
  assert.ok(edited.status === 'matched' && edited.rules.includes('user/investigate') && edited.triggered?.includes('user/investigate'));

  const dropped = rulesOf(sonnet({ add: [{ ...replace, triggers: [] }] }), presets);
  assert.deepEqual(dropped.find((r) => r.id === 'user/investigate')?.triggers, []);
  // Triggers taken from the replaced rule are checked as the rule's own, and the problem says where they came from.
  assert.ok(
    problemsOf(sonnet({ add: [{ ...replace, scopes: ['*'] }] }), presets).includes(
      `/models/${SONNET}/add/0/triggers: the rule is for every scope ("*"), so it already reaches every session; a trigger adds nothing ` +
        '(the rule takes its triggers from "sonnet/investigate", which it replaces; give "triggers": [] to drop them)',
    ),
  );
});

test('a "replaces" must name one preset rule of the model, replaced once, and neither enabled nor disabled', () => {
  const at = `/models/${SONNET}/add`;
  assert.deepEqual(problemsOf(sonnet({ add: [{ ...carry, replaces: 'sonnet/nope' }] })), [`${at}/0/replaces: preset "lab" has no rule "sonnet/nope" for ${SONNET}`]);
  assert.deepEqual(problemsOf(sonnet({ add: [{ ...carry, replaces: 'haiku/general' }] })), [`${at}/0/replaces: preset "lab" has no rule "haiku/general" for ${SONNET}`]);
  assert.deepEqual(problemsOf(sonnet({ add: [carry, { ...carry, id: 'user/carry-2' }] })), [
    `${at}/1/replaces: rule "sonnet/carry-through" is already replaced by "user/carry"; a preset rule is replaced by one rule at most`,
  ]);
  assert.deepEqual(problemsOf(sonnet({ enable: ['sonnet/progress-updates'], add: [{ ...carry, replaces: 'sonnet/progress-updates' }] })), [
    `${at}/0/replaces: rule "sonnet/progress-updates" is both replaced and enabled; remove it from "enable" to deliver "user/carry" in its place`,
  ]);
  assert.deepEqual(problemsOf(sonnet({ disable: ['sonnet/carry-through'], add: [carry] })), [
    `${at}/0/replaces: rule "sonnet/carry-through" is both replaced and disabled; "replaces" already turns it off, so remove it from "disable"`,
  ]);
  // The rule keeps an id of its own, so the decision log tells the two apart.
  assert.deepEqual(problemsOf(sonnet({ add: [{ ...carry, id: 'sonnet/carry-through' }] })), [`${at}/0/id: rule id "sonnet/carry-through" is already used for ${SONNET}`]);
});

test('the schema allows "replaces" only in "add" of a model declared with "use": "preset"', () => {
  assert.deepEqual(problemsOf({ models: { [SONNET]: { use: 'custom', add: [carry] } } }), [
    `/models/${SONNET}/add/0/replaces: unknown key ("replaces" names a preset rule, so it is only for a model declared with "use": "preset")`,
  ]);
  assert.deepEqual(problemsOf({ all_models: { add: [carry] }, models: { [SONNET]: { use: 'preset' } } }), ['/all_models/add/0/replaces: unknown key']);
  assert.match(problemsOf(sonnet({ add: [{ ...carry, replaces: 'Not An Id' }] })).join('\n'), /^\/models\/claude-sonnet-5-5\/add\/0\/replaces: "Not An Id" does not have the expected form/);
});

test('the declared model records each "replaces" as written and the keys the rule takes from the replaced rule', () => {
  const { declared } = loadConfigDetails(configTree(sonnet({ add: [carry, { ...carry, id: 'user/inv', replaces: 'sonnet/investigate', scopes: ['investigate'] }] })), {
    presetsDir: LAB_PRESETS,
  });
  assert.deepEqual(declared.get(SONNET)?.add, [
    { id: 'user/carry', file: 'carry.md', replaces: { id: 'sonnet/carry-through', inherits: ['scopes', 'places', 'triggers'] } },
    { id: 'user/inv', file: 'carry.md', replaces: { id: 'sonnet/investigate', inherits: ['places', 'triggers'] } },
  ]);
});

function cli(args: string[], config: Record<string, unknown>): ReturnType<typeof runCli> {
  return runCli(args, { NOONSIGHT_CONFIG: configTree(config), NOONSIGHT_PRESETS_DIR: LAB_PRESETS });
}

test('models lists the replaced rule off, followed by the rule delivered in its place', () => {
  const config = sonnet({ add: [carry] }, { all_models: { add: [team] } });
  const r = cli(['models'], config);
  assert.equal(r.status, 0, r.stderr);
  assert.match(
    r.stdout,
    /^ {2}off {2}sonnet\/carry-through {2}\(scopes: every scope; places: unattended, subagent; replaced by user\/carry\)\n(?: {7}.*\n)* {2}on {3}user\/carry {2}\(scopes: every scope; places: unattended, subagent; replaces sonnet\/carry-through\)\n {7}file: carry\.md$/m,
  );
  assert.match(r.stdout, new RegExp(`^${SONNET}: preset, 4 of 6 rules on;`, 'm'));

  const json = JSON.parse(cli(['models', '--json'], config).stdout) as {
    declared: { key: string; rules: { id: string; on: boolean; replaced_by?: string; replaces?: string; from?: string }[] }[];
  };
  assert.deepEqual(
    json.declared[0]?.rules.map((x) => [x.id, x.on, x.replaced_by ?? x.replaces ?? x.from ?? null]),
    [
      ['sonnet/general', true, null],
      ['sonnet/investigate', true, null],
      ['sonnet/carry-through', false, 'user/carry'],
      ['user/carry', true, 'sonnet/carry-through'],
      ['sonnet/progress-updates', false, null],
      ['team/commits', true, 'all_models'],
    ],
  );
});

test('check refuses a "replaces" that names no preset rule', () => {
  const r = cli(['check'], sonnet({ add: [{ ...carry, replaces: 'sonnet/carry-thru' }] }));
  assert.equal(r.status, 2);
  assert.match(
    r.stdout,
    /^problem: config .*: refused, so sessions get no rules:\n {2}- \/models\/claude-sonnet-5-5\/add\/0\/replaces: preset "lab" has no rule "sonnet\/carry-thru" for claude-sonnet-5-5$/m,
  );
  assert.match(cli(['check'], sonnet({ add: [carry] })).stdout, /^ok: config .*: valid/m);
});
