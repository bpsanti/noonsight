// The "all_models" block: rules for every model in one place. How they are delivered next to the
// preset's rules and a model's own, which models skip them, which rule ids collide, how they count
// toward each model's delivery limit, and how `noonsight models` and `noonsight check` show them.

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { ConfigError, loadConfig } from '../src/config/load.js';
import { resolve, resolveAdded } from '../src/core/resolve.js';
import { RULES_TEXT_LIMIT } from '../src/core/types.js';
import { LAB_PRESETS, runCli, tempTree } from './helpers.js';

const TEAM = 'TEAM-COMMITS-4417';
const OWN = 'OWN-STYLE-5528';
const VERIFY = 'TEAM-VERIFY-6639';

/** A configuration file next to the rule files the tests write; `config` overrides the defaults. */
function configTree(config: Record<string, unknown>, files: Record<string, string> = {}): string {
  const dir = tempTree({
    'team.md': `Commits use the imperative mood. ${TEAM}`,
    'own.md': `Prefer small functions. ${OWN}`,
    'verify.md': `Run the tests after an edit. ${VERIFY}`,
    ...files,
    'noonsight.json': { version: 1, preset: 'lab', ...config },
  });
  return path.join(dir, 'noonsight.json');
}

function problemsOf(config: Record<string, unknown>, files: Record<string, string> = {}): readonly string[] {
  try {
    loadConfig(configTree(config, files), { presetsDir: LAB_PRESETS });
  } catch (e) {
    if (e instanceof ConfigError) return e.problems;
    throw e;
  }
  assert.fail('the configuration was accepted');
}

const team = { id: 'team/commits', file: 'team.md' };

test('the rules go after the preset\'s and before the model\'s own, and reach a preset model and a custom model', () => {
  const config = loadConfig(
    configTree({
      all_models: { add: [team] },
      models: {
        'claude-sonnet-5-5': { use: 'preset', add: [{ id: 'user/own', file: 'own.md' }] },
        'claude-haiku-5-5': { use: 'custom', add: [{ id: 'user/own', file: 'own.md' }] },
      },
    }),
    { presetsDir: LAB_PRESETS },
  );
  const sonnet = resolve(config, { model: 'claude-sonnet-5-5', place: 'session' });
  assert.equal(sonnet.status, 'matched');
  if (sonnet.status !== 'matched') return;
  assert.deepEqual(sonnet.rules, ['sonnet/general', 'team/commits', 'user/own']);
  assert.ok(sonnet.text.indexOf('SONNET-GEN-3306') < sonnet.text.indexOf(TEAM) && sonnet.text.indexOf(TEAM) < sonnet.text.indexOf(OWN));

  const haiku = resolve(config, { model: 'claude-haiku-5-5', place: 'session' });
  assert.equal(haiku.status === 'matched' && haiku.rules.join(' '), 'team/commits user/own');
  assert.deepEqual(config.allModels.map((r) => r.id), ['team/commits']);
});

test('a model declared with "use": "custom" can take only the rules of all_models, and needs some rule from one place or the other', () => {
  const config = loadConfig(configTree({ all_models: { add: [team] }, models: { 'claude-haiku-5-5': { use: 'custom' } } }), { presetsDir: LAB_PRESETS });
  const haiku = resolve(config, { model: 'claude-haiku-5-5', place: 'subagent' });
  assert.equal(haiku.status === 'matched' && haiku.rules.join(' '), 'team/commits');

  assert.deepEqual(problemsOf({ models: { 'claude-haiku-5-5': { use: 'custom' } } }), [
    '/models/claude-haiku-5-5: a model declared with "use": "custom" must receive at least one rule: give "add" at least one, or declare rules under "all_models"',
  ]);
  assert.match(problemsOf({ all_models: { add: [team] }, models: { 'claude-haiku-5-5': { use: 'custom', add: [] } } }).join('\n'), /^\/models\/claude-haiku-5-5\/add: must not be empty/);
});

test('a model declared with "use": "none", by an exact key or a wildcard, receives none of them', () => {
  const config = loadConfig(
    configTree({
      all_models: { add: [team] },
      models: { 'claude-sonnet-5-5': { use: 'preset' }, 'claude-opus-5-5': { use: 'none' }, 'claude-opus-4-*': { use: 'none' } },
    }),
    { presetsDir: LAB_PRESETS },
  );
  for (const model of ['claude-opus-5-5', 'claude-opus-4-1']) {
    const d = resolve(config, { model, place: 'session' });
    assert.equal(d.status, 'none', model);
    assert.equal(d.status === 'none' && d.reason, 'declared-none');
  }
  assert.equal(resolve(config, { model: 'claude-sonnet-5-5', place: 'session' }).status, 'matched');
  // A model that is not declared stays undeclared; the block declares nothing.
  assert.equal(resolve(config, { model: 'claude-haiku-5-5', place: 'session' }).status, 'undeclared');
  assert.equal(config.exact.get('claude-opus-5-5')?.use, 'none');
});

test('the rules keep their own scopes and places', () => {
  const config = loadConfig(
    configTree({
      all_models: { add: [{ id: 'team/commits', file: 'team.md', scopes: ['investigate'], where: ['session'] }] },
      models: { 'claude-haiku-5-5': { use: 'custom', add: [{ id: 'user/own', file: 'own.md' }] } },
    }),
    { presetsDir: LAB_PRESETS },
  );
  const ids = (scope: string | null, place: 'session' | 'subagent'): string =>
    String((resolve(config, { model: 'claude-haiku-5-5', scope, place }) as { rules?: string[] }).rules);
  assert.equal(ids(null, 'session'), 'user/own');
  assert.equal(ids('investigate', 'session'), 'team/commits,user/own');
  assert.equal(ids('investigate', 'subagent'), 'user/own');
});

test('a rule id must be new: it cannot repeat in the block, nor be a preset rule or an own rule of a model that receives it', () => {
  assert.deepEqual(problemsOf({ all_models: { add: [team, { id: 'team/commits', file: 'own.md' }] } }), [
    '/all_models/add/1/id: rule id "team/commits" is used more than once in "all_models"',
  ]);

  const withPreset = problemsOf({ all_models: { add: [{ id: 'sonnet/general', file: 'team.md' }] }, models: { 'claude-sonnet-5-5': { use: 'preset' } } });
  assert.equal(withPreset.length, 1);
  assert.match(withPreset[0] ?? '', /^\/all_models\/add\/0\/id: rule id "sonnet\/general" is already a preset rule for claude-sonnet-5-5/);

  const withOwn = problemsOf({
    all_models: { add: [team] },
    models: { 'claude-haiku-5-5': { use: 'custom', add: [{ id: 'user/own', file: 'own.md' }, { id: 'team/commits', file: 'own.md' }] } },
  });
  assert.deepEqual(withOwn, ['/models/claude-haiku-5-5/add/1/id: rule id "team/commits" is already used for claude-haiku-5-5 by "all_models"']);

  // The same id is fine for a model that does not receive the block, and one id may repeat across models.
  const config = loadConfig(
    configTree({
      all_models: { add: [team] },
      models: { 'claude-opus-5-5': { use: 'none' }, 'claude-haiku-5-5': { use: 'custom' }, 'claude-sonnet-5-5': { use: 'preset' } },
    }),
    { presetsDir: LAB_PRESETS },
  );
  assert.equal(config.exact.size, 3);
});

test('a problem in a rule of the block is reported once, at the block, not once per model', () => {
  const missing = problemsOf({
    all_models: { add: [{ id: 'team/commits', file: 'missing.md', scopes: ['nowhere'] }] },
    models: { 'claude-sonnet-5-5': { use: 'preset' }, 'claude-haiku-5-5': { use: 'preset' } },
  });
  assert.equal(missing.length, 2, missing.join('\n'));
  assert.ok(missing.every((p) => p.startsWith('/all_models/add/0/')), missing.join('\n'));
});

test('the delivery limit counts the block for every model, and names the model it overflows', () => {
  // Big enough that the sonnet preset's rules on top of it overflow, and the haiku preset's one rule does not.
  const big = { 'big.md': 'x'.repeat(8950) };
  const all = { add: [{ id: 'team/big', file: 'big.md' }] };
  const haikuOnly = loadConfig(configTree({ all_models: all, models: { 'claude-haiku-5-5': { use: 'preset' } } }, big), { presetsDir: LAB_PRESETS });
  assert.equal(haikuOnly.exact.size, 1);

  const problems = problemsOf({ all_models: all, models: { 'claude-haiku-5-5': { use: 'preset' }, 'claude-sonnet-5-5': { use: 'preset' } } }, big);
  assert.ok(problems.length > 0);
  assert.ok(problems.every((p) => p.startsWith('/models/claude-sonnet-5-5: ')), problems.join('\n'));
  assert.match(problems[0] ?? '', new RegExp(`characters \\(\\d+ of the \\d+ rules are from "all_models", which every model declared with "use": "preset" or "use": "custom" receives\\); the limit is ${RULES_TEXT_LIMIT}`));

  // A model declared "none" takes none of it, and a block that alone cannot fit refuses every model that receives it.
  const none = loadConfig(configTree({ all_models: all, models: { 'claude-haiku-5-5': { use: 'preset' }, 'claude-sonnet-5-5': { use: 'none' } } }, big), { presetsDir: LAB_PRESETS });
  assert.equal(none.exact.get('claude-sonnet-5-5')?.use, 'none');
  const alone = problemsOf({ all_models: { add: [{ id: 'team/huge', file: 'huge.md' }] }, models: { 'claude-haiku-5-5': { use: 'custom' } } }, { 'huge.md': 'x'.repeat(RULES_TEXT_LIMIT) });
  assert.match(alone.join('\n'), /^\/models\/claude-haiku-5-5: the rules delivered for no scope in place "session"/);
});

test('triggers on a rule of the block deliver it to a session of another scope after its first tracked edit', () => {
  const config = loadConfig(
    configTree({
      all_models: { add: [{ id: 'team/verify', file: 'verify.md', scopes: ['investigate'], where: ['session'], triggers: ['code-edit'] }] },
      models: { 'claude-sonnet-5-5': { use: 'preset' }, 'claude-haiku-5-5': { use: 'custom', add: [{ id: 'user/own', file: 'own.md' }] } },
    }),
    { presetsDir: LAB_PRESETS },
  );
  for (const model of ['claude-sonnet-5-5', 'claude-haiku-5-5']) {
    const base = { model, scope: null, place: 'session' } as const;
    const before = resolve(config, base);
    assert.ok(before.status !== 'matched' || !before.rules.includes('team/verify'), model);

    const added = resolveAdded(config, { ...base, triggers: ['code-edit'] }, []);
    assert.equal(added.status, 'matched', model);
    if (added.status !== 'matched') return;
    assert.deepEqual([added.rules, added.triggered], [['team/verify'], ['team/verify']]);
    assert.match(added.text, new RegExp(VERIFY));
    assert.match(added.text, /^<noonsight-rules model="[^"]+" trigger="code-edit">/);
  }

  // The same trigger checks as a model's own rule: not for every scope, not for subagents only.
  assert.deepEqual(problemsOf({ all_models: { add: [{ id: 'team/verify', file: 'verify.md', triggers: ['code-edit'] }] }, models: { 'claude-haiku-5-5': { use: 'preset' } } }), [
    '/all_models/add/0/triggers: the rule is for every scope ("*"), so it already reaches every session; a trigger adds nothing',
  ]);
});

test('the schema refuses an empty block and an unknown key in it', () => {
  assert.match(problemsOf({ all_models: { add: [] } }).join('\n'), /^\/all_models\/add: must not be empty/);
  assert.match(problemsOf({ all_models: {} }).join('\n'), /^\/all_models: missing required key "add"/);
  assert.match(problemsOf({ all_models: { add: [team], disable: ['x'] } }).join('\n'), /^\/all_models\/disable: unknown key/);
});

function cli(args: string[], config: Record<string, unknown>, files: Record<string, string> = {}): ReturnType<typeof runCli> {
  return runCli(args, { NOONSIGHT_CONFIG: configTree(config, files), NOONSIGHT_PRESETS_DIR: LAB_PRESETS });
}

test('models lists the block, and each model\'s rules in delivery order with those of the block marked', () => {
  const config = {
    all_models: { add: [team] },
    models: {
      'claude-sonnet-5-5': { use: 'preset', disable: ['sonnet/carry-through'], add: [{ id: 'user/own', file: 'own.md' }] },
      'claude-opus-5-5': { use: 'none' },
    },
  };
  const r = cli(['models'], config);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^all_models: 1 rule for every model declared with "use": "preset" or "use": "custom", after the preset's rules and before the model's own$/m);
  assert.match(r.stdout, /^ {2}on {3}team\/commits {2}\(scopes: every scope; places: session, unattended, subagent; from all_models\)\n {7}file: team\.md$/m);

  const sonnet = r.stdout.slice(r.stdout.indexOf('claude-sonnet-5-5: '), r.stdout.indexOf('claude-opus-5-5: '));
  const order = ['sonnet/general', 'team/commits', 'user/own'].map((id) => sonnet.indexOf(`  ${id}  (`));
  assert.ok(order.every((i) => i > 0) && order[0]! < order[1]! && order[1]! < order[2]!, sonnet);
  assert.match(r.stdout, /^claude-opus-5-5: none, by decision/m);
  assert.doesNotMatch(r.stdout.slice(r.stdout.indexOf('claude-opus-5-5: ')), /team\/commits/);

  const json = JSON.parse(cli(['models', '--json'], config).stdout) as {
    all_models: { id: string; from?: string; file?: string }[];
    declared: { key: string; rules: { id: string; from?: string; file?: string }[] }[];
  };
  assert.deepEqual(json.all_models.map((r) => [r.id, r.from, r.file]), [['team/commits', 'all_models', 'team.md']]);
  assert.deepEqual(json.declared.find((m) => m.key === 'claude-sonnet-5-5')?.rules.map((r) => [r.id, r.from ?? null]), [
    ['sonnet/general', null],
    ['sonnet/investigate', null],
    ['sonnet/carry-through', null],
    ['sonnet/progress-updates', null],
    ['team/commits', 'all_models'],
    ['user/own', null],
  ]);
  assert.deepEqual(json.declared.find((m) => m.key === 'claude-opus-5-5')?.rules, []);
});

test('check reports the block and the models that receive it, and refuses a model the block overflows', () => {
  const ok = cli(['check'], { all_models: { add: [team] }, models: { 'claude-sonnet-5-5': { use: 'preset' }, 'claude-opus-5-5': { use: 'none' } } });
  assert.match(ok.stdout, /^ok: all_models: 1 rule \(team\/commits\) delivered to 1 model declared with preset or custom \(claude-sonnet-5-5\), each within the 9500-character limit on the rules delivered$/m);

  const idle = cli(['check'], { all_models: { add: [team] }, models: { 'claude-opus-5-5': { use: 'none' } } });
  assert.match(idle.stdout, /^warning: all_models: no model is declared with "use": "preset" or "use": "custom", so no model receives these rules$/m);

  const big = cli(['check'], { all_models: { add: [{ id: 'team/big', file: 'big.md' }] }, models: { 'claude-sonnet-5-5': { use: 'preset' } } }, { 'big.md': 'x'.repeat(8950) });
  assert.equal(big.status, 2);
  assert.match(big.stdout, /problem: config .*refused, so sessions get no rules:[\s\S]*\/models\/claude-sonnet-5-5: .*from "all_models"/);

  const noBlock = cli(['check'], { models: { 'claude-sonnet-5-5': { use: 'preset' } } });
  assert.doesNotMatch(noBlock.stdout, /all_models/);
});
