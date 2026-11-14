// A configuration with any problem is refused whole, with every problem listed.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ConfigError, loadConfig } from '../src/config/load.js';
import { LAB_PRESETS, labPresetWith, tempTree } from './helpers.js';

function problemsOf(config: unknown, files: Record<string, string> = {}, presetsDir: string = LAB_PRESETS): readonly string[] {
  const dir = tempTree({ 'sextant.json': config, ...files });
  try {
    loadConfig(path.join(dir, 'sextant.json'), { presetsDir });
  } catch (e) {
    if (e instanceof ConfigError) return e.problems;
    throw e;
  }
  assert.fail('the configuration was accepted');
}

function assertProblem(problems: readonly string[], pattern: RegExp): void {
  assert.ok(
    problems.some((p) => pattern.test(p)),
    `no problem matches ${pattern}; got:\n${problems.join('\n')}`,
  );
}

const custom = (file = 'r.md') => ({ use: 'custom', add: [{ id: 'r', file }] });

test('a missing file, unreadable JSON and a wrong version are refused', () => {
  assert.throws(() => loadConfig(path.join(tempTree({}), 'sextant.json')), /no configuration file here/);
  assertProblem(problemsOf('{ not json'), /not valid JSON/);
  assertProblem(problemsOf({ version: 2 }), /^\/version: must be 1$/);
  assertProblem(problemsOf({}), /missing required key "version"/);
});

test('an unknown key is an error that names the key, at any depth', () => {
  assertProblem(problemsOf({ version: 1, routing: { enabled: true } }), /^\/routing: unknown key$/);
  assertProblem(problemsOf({ version: 1, models: { 'claude-sonnet-5-5': { use: 'none', pin: true } } }), /^\/models\/claude-sonnet-5-5\/pin: unknown key/);
  assertProblem(
    problemsOf({ version: 1, models: { 'claude-haiku-5-5': { use: 'custom', add: [{ id: 'r', file: 'r.md', scope: ['x'] }] } } }, { 'r.md': 'x' }),
    /^\/models\/claude-haiku-5-5\/add\/0\/scope: unknown key$/,
  );
});

test('wildcard keys only accept {"use": "none"}', () => {
  assertProblem(problemsOf({ version: 1, preset: 'lab', models: { 'claude-sonnet-*': { use: 'preset' } } }), /^\/models\/claude-sonnet-\*\/use: must be "none" \(a wildcard key only accepts/);
  assertProblem(problemsOf({ version: 1, models: { 'claude-sonnet-*': custom() } }, { 'r.md': 'x' }), /^\/models\/claude-sonnet-\*\/add: unknown key \(a wildcard key only accepts/);
});

test('model keys are full identifiers: no aliases, no capitals, no suffixes, no provider prefixes', () => {
  for (const key of ['sonnet', 'opus', 'Claude-Sonnet-5-5', 'claude-sonnet-5-5[1m]', 'anthropic/claude-sonnet-5-5', 'claude sonnet 5'])
    assertProblem(problemsOf({ version: 1, models: { [key]: { use: 'none' } } }), /: key "[^"]*" does not have the expected form \(a model key is a full lowercase model identifier/);
  assertProblem(
    problemsOf({ version: 1, models: { 'global.anthropic.claude-sonnet-5-5': { use: 'none' } } }),
    /^\/models\/global\.anthropic\.claude-sonnet-5-5: write the bare model identifier "claude-sonnet-5-5"/,
  );
  assertProblem(
    problemsOf({ version: 1, models: { 'us.anthropic.claude-opus-4-*': { use: 'none' } } }),
    /^\/models\/us\.anthropic\.claude-opus-4-\*: write the bare model identifier "claude-opus-4-\*"/,
  );
});

test('"none" takes no other key, and "custom" needs at least one rule and nothing else', () => {
  assertProblem(problemsOf({ version: 1, models: { 'claude-sonnet-5-5': { use: 'none', add: [] } } }), /^\/models\/claude-sonnet-5-5\/add: unknown key \(a model declared with "use": "none" takes no other key\)/);
  assertProblem(problemsOf({ version: 1, models: { 'claude-sonnet-5-5': { use: 'custom' } } }), /^\/models\/claude-sonnet-5-5: missing required key "add"/);
  assertProblem(problemsOf({ version: 1, models: { 'claude-sonnet-5-5': { use: 'custom', add: [] } } }), /^\/models\/claude-sonnet-5-5\/add: must not be empty/);
  assertProblem(
    problemsOf({ version: 1, models: { 'claude-sonnet-5-5': { ...custom(), disable: ['x'] } } }, { 'r.md': 'x' }),
    /^\/models\/claude-sonnet-5-5\/disable: unknown key \(a model declared with "use": "custom"/,
  );
});

test('"preset" needs an installed preset with rules for that exact model', () => {
  assertProblem(problemsOf({ version: 1, models: { 'claude-sonnet-5-5': { use: 'preset' } } }), /^\/preset: preset "claude" is not installed/);
  assertProblem(problemsOf({ version: 1, preset: 'nope', models: {} }), /^\/preset: preset "nope" is not installed/);
  assertProblem(problemsOf({ version: 1, preset: 'lab', models: { 'claude-fable-5-2': { use: 'preset' } } }), /^\/models\/claude-fable-5-2: preset "lab" has no rules for claude-fable-5-2/);
});

test('enable and disable must name preset rules of that model, and not the same rule twice', () => {
  const problems = problemsOf({
    version: 1,
    preset: 'lab',
    models: {
      'claude-sonnet-5-5': { use: 'preset', enable: ['haiku/general', 'sonnet/general'], disable: ['sonnet/general', 'sonnet/nope'] },
    },
  });
  assertProblem(problems, /^\/models\/claude-sonnet-5-5\/enable: preset "lab" has no rule "haiku\/general" for claude-sonnet-5-5/);
  assertProblem(problems, /^\/models\/claude-sonnet-5-5\/disable: preset "lab" has no rule "sonnet\/nope"/);
  assertProblem(problems, /^\/models\/claude-sonnet-5-5: rule "sonnet\/general" is both enabled and disabled/);
});

test('user rules: the file must exist and hold text, the id must be free, the scopes declared', () => {
  const problems = problemsOf(
    {
      version: 1,
      preset: 'lab',
      scopes: { review: {} },
      models: {
        'claude-sonnet-5-5': {
          use: 'preset',
          add: [
            { id: 'sonnet/general', file: 'a.md' },
            { id: 'mine', file: 'missing.md' },
            { id: 'mine', file: 'empty.md' },
            { id: 'scoped', file: 'a.md', scopes: ['review', 'investigate', 'nope'] },
            { id: 'all', file: 'a.md', scopes: ['*', 'review'] },
          ],
        },
      },
    },
    { 'a.md': 'A', 'empty.md': ' \n\n' },
  );
  assertProblem(problems, /\/add\/0\/id: rule id "sonnet\/general" is already used for claude-sonnet-5-5/);
  assertProblem(problems, /\/add\/1\/file: cannot read .*missing\.md \(ENOENT\)/);
  assertProblem(problems, /\/add\/2\/id: rule id "mine" is already used/);
  assertProblem(problems, /\/add\/2\/file: .*empty\.md is empty/);
  assertProblem(problems, /\/add\/3\/scopes: scope "nope" is not declared/);
  assert.ok(!problems.some((p) => /scope "(review|investigate)" is not declared/.test(p)), problems.join('\n'));
  assertProblem(problems, /\/add\/4\/scopes: "\*" already covers every scope; list it alone/);
});

test('every combination of scope and place must fit the delivery limit', () => {
  const big = 'x'.repeat(6000);
  const problems = problemsOf(
    {
      version: 1,
      scopes: { review: {} },
      models: {
        'claude-haiku-5-5': {
          use: 'custom',
          add: [
            { id: 'a', file: 'a.md', where: ['session'] },
            { id: 'b', file: 'b.md', scopes: ['review'], where: ['session'] },
          ],
        },
      },
    },
    { 'a.md': big, 'b.md': big },
  );
  assert.equal(problems.length, 1, problems.join('\n'));
  assertProblem(problems, /^\/models\/claude-haiku-5-5: the rules delivered for scope "review" in place "session" come to \d+ characters; the limit is 10000$/);
});

test('a text exactly at the limit is accepted', () => {
  const dir = tempTree({ 'sextant.json': { version: 1, models: { 'claude-haiku-5-5': custom() } } });
  const envelopeSize = '<sextant-rules model="claude-haiku-5-5">\nWorking rules the user declared for claude-haiku-5-5 (delivered by sextant, rules r):\n\n</sextant-rules>'.length;
  fs.writeFileSync(path.join(dir, 'r.md'), 'y'.repeat(10000 - envelopeSize));
  loadConfig(path.join(dir, 'sextant.json'));
  fs.writeFileSync(path.join(dir, 'r.md'), 'y'.repeat(10001 - envelopeSize));
  assert.throws(() => loadConfig(path.join(dir, 'sextant.json')), /come to 10001 characters/);
});

test('every problem is reported at once, so one fix round is enough', () => {
  const problems = problemsOf({
    version: 1,
    on_undeclared: 'block',
    models: { sonnet: { use: 'none' }, 'claude-opus-*': { use: 'preset' } },
    extra: true,
  });
  assertProblem(problems, /^\/on_undeclared: must be one of "warn", "ignore"/);
  assertProblem(problems, /^\/models\/sonnet: key/);
  assertProblem(problems, /^\/models\/claude-opus-\*\/use: must be "none"/);
  assertProblem(problems, /^\/extra: unknown key/);
});

test('the preset is checked too: sources, scopes, files and its own id', () => {
  const missingSource = labPresetWith((p) => {
    delete p.models['claude-haiku-5-5'].rules[0].source;
  });
  assertProblem(problemsOf({ version: 1, preset: 'lab' }, {}, missingSource), /^preset .*preset\.json: \/models\/claude-haiku-5-5\/rules\/0: missing required key "source"/);

  const badScope = labPresetWith((p) => {
    p.models['claude-haiku-5-5'].rules[0].scopes = ['summarize'];
    p.models['claude-haiku-5-5'].rules[0].file = 'rules/missing.md';
    p.id = 'other';
  });
  const problems = problemsOf({ version: 1, preset: 'lab', scopes: { summarize: {} } }, {}, badScope);
  assertProblem(problems, /\/models\/claude-haiku-5-5\/rules\/0\/scopes: scope "summarize" is not declared/);
  assertProblem(problems, /\/models\/claude-haiku-5-5\/rules\/0\/file: cannot read/);
  assertProblem(problems, /\/id: is "other", but the preset is installed as "lab"/);

  const aliasKey = labPresetWith((p) => {
    p.models.sonnet = p.models['claude-sonnet-5-5'];
  });
  assertProblem(problemsOf({ version: 1, preset: 'lab' }, {}, aliasKey), /\/models\/sonnet: key "sonnet" does not have the expected form/);
});

test('an unused default preset that is not installed is not a problem', () => {
  const dir = tempTree({ 'sextant.json': { version: 1, models: { 'claude-sonnet-5-5': { use: 'none' } } } });
  loadConfig(path.join(dir, 'sextant.json'), { presetsDir: tempTree({}) });
});
