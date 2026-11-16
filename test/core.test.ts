import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { loadConfig } from '../src/config/load.js';
import { normalizeModel } from '../src/core/normalize.js';
import { launcherNote, resolve, switchNote } from '../src/core/resolve.js';
import { SWITCH_NOTE_RESERVE } from '../src/core/types.js';
import type { Config, Decision, MatchedDecision, Place } from '../src/core/types.js';
import { LAB_CONFIG, LAB_PRESETS, tempTree } from './helpers.js';

const lab = loadConfig(LAB_CONFIG, { presetsDir: LAB_PRESETS });
const matched = (d: Decision): MatchedDecision => {
  assert.equal(d.status, 'matched', JSON.stringify(d));
  return d as MatchedDecision;
};
const load = (config: unknown, files: Record<string, string> = {}): Config => {
  const dir = tempTree({ 'noonsight.json': config, ...files });
  return loadConfig(path.join(dir, 'noonsight.json'), { presetsDir: LAB_PRESETS });
};

test('normalize: suffixes, provider paths, Bedrock and Vertex forms, and case', () => {
  const cases: [string | null | undefined, string][] = [
    ['claude-fable-5-2', 'claude-fable-5-2'],
    ['claude-fable-5-2[1m]', 'claude-fable-5-2'],
    ['anthropic/claude-fable-5-2#high', 'claude-fable-5-2'],
    ['global.anthropic.claude-fable-5-2', 'claude-fable-5-2'],
    ['us.anthropic.claude-sonnet-5-5', 'claude-sonnet-5-5'],
    ['anthropic.claude-haiku-5-5', 'claude-haiku-5-5'],
    ['global.anthropic.claude-fable-5-2-v1:0', 'claude-fable-5-2'],
    ['anthropic.claude-haiku-5-5-v2:1', 'claude-haiku-5-5'],
    ['global.anthropic.claude-opus-5-5-v1', 'claude-opus-5-5'],
    ['us-gov.anthropic.claude-sonnet-5-5-v1:0', 'claude-sonnet-5-5'],
    ['claude-sonnet-5-5@20261001', 'claude-sonnet-5-5'],
    ['claude-opus-5-5@latest', 'claude-opus-5-5'],
    ['  CLAUDE-OPUS-5-5  ', 'claude-opus-5-5'],
    ['', ''],
    [null, ''],
    [undefined, ''],
  ];
  for (const [input, expected] of cases) assert.equal(normalizeModel(input), expected, String(input));
});

test('place: each place gets only the rules declared for it', () => {
  const at = (place: Place): readonly string[] => matched(resolve(lab, { model: 'claude-sonnet-5-5', place })).rules;
  assert.deepEqual(at('session'), ['sonnet/general']);
  assert.deepEqual(at('unattended'), ['sonnet/general', 'sonnet/carry-through']);
  assert.deepEqual(at('subagent'), ['sonnet/general', 'sonnet/carry-through']);
});

test('place and scope combine: scope rules come in declaration order with place-specific rules', () => {
  const d = matched(resolve(lab, { model: 'claude-sonnet-5-5', scope: 'investigate', place: 'subagent' }));
  assert.deepEqual(d.rules, ['sonnet/general', 'sonnet/investigate', 'sonnet/carry-through']);
});

test('place: a model whose rules all live elsewhere resolves to none here', () => {
  const cfg = load({ version: 1, preset: 'lab', models: { 'claude-sonnet-5-5': { use: 'preset', disable: ['sonnet/general'] } } });
  assert.equal(resolve(cfg, { model: 'claude-sonnet-5-5', place: 'session' }).status, 'none');
  assert.deepEqual(matched(resolve(cfg, { model: 'claude-sonnet-5-5', place: 'unattended' })).rules, ['sonnet/carry-through']);
});

test('enable turns on a preset rule that ships off', () => {
  const cfg = load({ version: 1, preset: 'lab', models: { 'claude-sonnet-5-5': { use: 'preset', enable: ['sonnet/progress-updates'] } } });
  assert.deepEqual(matched(resolve(cfg, { model: 'claude-sonnet-5-5', place: 'session' })).rules, [
    'sonnet/general',
    'sonnet/progress-updates',
  ]);
  assert.deepEqual(matched(resolve(lab, { model: 'claude-sonnet-5-5', place: 'session' })).rules, ['sonnet/general']);
});

test('user rules default to every scope and every place', () => {
  const cfg = load(
    { version: 1, models: { 'claude-haiku-5-5': { use: 'custom', add: [{ id: 'mine', file: 'mine.md' }] } } },
    { 'mine.md': 'MINE-1234\r\n' },
  );
  for (const place of ['session', 'unattended', 'subagent'] as const) {
    const d = matched(resolve(cfg, { model: 'claude-haiku-5-5', scope: null, place }));
    assert.deepEqual(d.rules, ['mine']);
    assert.match(d.text, /\nMINE-1234\n<\/noonsight-rules>$/);
  }
});

test('an undeclared scope means general rules, and the decision says which scope was ignored', () => {
  const d = matched(resolve(lab, { model: 'claude-sonnet-5-5', scope: 'no-such-scope', place: 'session' }));
  assert.deepEqual(d.rules, ['sonnet/general']);
  assert.equal(d.scope, null);
  assert.equal(d.unknown_scope, 'no-such-scope');
  assert.doesNotMatch(d.text, /no-such-scope/);
  assert.equal(matched(resolve(lab, { model: 'claude-sonnet-5-5', scope: 'investigate', place: 'session' })).unknown_scope, undefined);
});

test('the delivered text is the envelope around the joined rules', () => {
  const d = matched(resolve(lab, { model: 'claude-sonnet-5-5[1m]', scope: 'investigate', place: 'session' }));
  const lines = d.text.split('\n');
  assert.equal(lines[0], '<noonsight-rules model="claude-sonnet-5-5" scope="investigate">');
  assert.equal(
    lines[1],
    'Working rules the user declared for claude-sonnet-5-5, task scope "investigate" (delivered by noonsight, rules sonnet/general, sonnet/investigate):',
  );
  assert.equal(lines.at(-1), '</noonsight-rules>');
  assert.match(d.text, /SONNET-GEN-3306\.\n.*\n\n- The verification word for the Sonnet 5.5 investigation-scope/);
  const general = matched(resolve(lab, { model: 'claude-sonnet-5-5', place: 'session' }));
  assert.equal(general.text.split('\n')[0], '<noonsight-rules model="claude-sonnet-5-5">');
});

test('wildcards: an exact key beats any wildcard, and more literal text beats less', () => {
  const cfg = load(
    {
      version: 1,
      models: {
        '*': { use: 'none' },
        'claude-opus-*': { use: 'none' },
        'claude-opus-5-*': { use: 'none' },
        'claude-opus-5-5': { use: 'custom', add: [{ id: 'opus', file: 'opus.md' }] },
      },
    },
    { 'opus.md': 'OPUS-5-5' },
  );
  const key = (model: string): string | undefined => {
    const d = resolve(cfg, { model, place: 'session' });
    return d.status === 'undeclared' ? undefined : d.key;
  };
  assert.equal(key('claude-opus-5-5'), 'claude-opus-5-5');
  assert.equal(key('claude-opus-5-6'), 'claude-opus-5-*');
  assert.equal(key('claude-opus-4-8'), 'claude-opus-*');
  assert.equal(key('some-other-model-1'), '*');
});

test('wildcards: "?" matches exactly one character and ties pick the same key every time', () => {
  const cfg = load({ version: 1, models: { 'claude-opus-?-5': { use: 'none' }, 'claude-opus-5-?': { use: 'none' } } });
  const d = resolve(cfg, { model: 'claude-opus-5-5', place: 'session' });
  assert.equal(d.status === 'none' && d.key, 'claude-opus-5-?');
  assert.equal(resolve(cfg, { model: 'claude-opus-5-55', place: 'session' }).status, 'undeclared');
});

test('undeclared models carry a warning unless the configuration says to ignore them', () => {
  const warn = resolve(lab, { model: 'claude-fable-5-2', place: 'subagent' });
  assert.equal(warn.status === 'undeclared' && warn.warning, 'noonsight: model claude-fable-5-2 has no declared rules (no-entry, subagent)');
  const quiet = load({ version: 1, on_undeclared: 'ignore', models: {} });
  const d = resolve(quiet, { model: 'claude-fable-5-2', place: 'session' });
  assert.equal(d.status, 'undeclared');
  assert.equal(d.status === 'undeclared' && d.warning, undefined);
});

test('a configuration with no models declares nothing', () => {
  const cfg = load({ version: 1 });
  assert.equal(resolve(cfg, { model: 'claude-sonnet-5-5', place: 'session' }).status, 'undeclared');
});

test('the model-change note always fits the room kept for it, whatever the model names', () => {
  const note = switchNote('claude-sonnet-5-5', 'claude-opus-5-5');
  assert.equal(
    note,
    '<noonsight-rules-change from="claude-sonnet-5-5" to="claude-opus-5-5">\n' +
      "The session's model changed from claude-sonnet-5-5 to claude-opus-5-5. " +
      'The working rules noonsight delivered earlier in this conversation for claude-sonnet-5-5 no longer apply.\n' +
      '</noonsight-rules-change>',
  );
  const long = switchNote('x'.repeat(300), 'y"<z>'.repeat(60));
  assert.ok(long.length + 2 <= SWITCH_NOTE_RESERVE, String(long.length));
  // Only the two tags' own quotes and angle brackets remain: the names cannot break the tags.
  assert.deepEqual([...long].filter((c) => c === '"' || c === '<' || c === '>').join(''), '<""""><>');
  assert.match(switchNote('', 'claude-opus-5-5'), /from="\(not reported\)"/);
});

test('the note for rules noonsight run put in the system prompt for another model fits the same room', () => {
  assert.equal(
    launcherNote('claude-sonnet-5-5', 'claude-haiku-5-5'),
    '<noonsight-rules-change from="claude-sonnet-5-5" to="claude-haiku-5-5">\n' +
      'This session runs on claude-haiku-5-5. ' +
      'The working rules for claude-sonnet-5-5 that noonsight added to the system prompt when it started the session do not apply.\n' +
      '</noonsight-rules-change>',
  );
  const long = launcherNote('x'.repeat(300), 'y"<z>'.repeat(60));
  assert.ok(long.length + 2 <= SWITCH_NOTE_RESERVE, String(long.length));
  assert.deepEqual([...long].filter((c) => c === '"' || c === '<' || c === '>').join(''), '<""""><>');
});
