// A configuration with any problem is refused whole, with its problems listed: schema problems first,
// then preset problems, then the rest.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ConfigError, loadConfig } from '../src/config/load.js';
import { LAB_PRESETS, labPresetWith, tempTree } from './helpers.js';

function problemsOf(config: unknown, files: Record<string, string> = {}, presetsDir: string = LAB_PRESETS): readonly string[] {
  const dir = tempTree({ 'noonsight.json': config, ...files });
  try {
    loadConfig(path.join(dir, 'noonsight.json'), { presetsDir });
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
  assert.throws(() => loadConfig(path.join(tempTree({}), 'noonsight.json')), /no configuration file here/);
  assertProblem(problemsOf('{ not json'), /not valid JSON/);
  assertProblem(problemsOf({ version: 2 }), /^\/version: must be 1$/);
  assertProblem(problemsOf({}), /missing required key "version"/);
});

test('an unknown key is an error that names the key, at any depth', () => {
  assertProblem(problemsOf({ version: 1, routing: { enabled: true, classifier: {} } }), /^\/routing\/classifier: unknown key$/);
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

test('every combination of scope and place must fit the delivery limit, with room for the model-change note', () => {
  const big = 'x'.repeat(6000);
  const problems = problemsOf(
    {
      version: 1,
      scopes: { review: {} },
      models: {
        'claude-haiku-5-5': {
          use: 'custom',
          add: [
            { id: 'a', file: 'a.md', where: ['attended'] },
            { id: 'b', file: 'b.md', scopes: ['review'], where: ['attended'] },
          ],
        },
      },
    },
    { 'a.md': big, 'b.md': big },
  );
  assert.equal(problems.length, 1, problems.join('\n'));
  assertProblem(problems, /^\/models\/claude-haiku-5-5: the rules delivered for scope "review" in place "attended" come to \d+ characters; the limit is 9500 \(Claude Code's 10000, less 500 kept for the model-change note\)$/);
});

test('a text exactly at the limit is accepted', () => {
  const dir = tempTree({ 'noonsight.json': { version: 1, models: { 'claude-haiku-5-5': custom() } } });
  const envelopeSize = '<noonsight-rules model="claude-haiku-5-5">\nWorking rules the user declared for claude-haiku-5-5 (delivered by noonsight, rules r):\n\n</noonsight-rules>'.length;
  // No preset here, so no scope is declared and the envelope is the one without a scope.
  const noPreset = { presetsDir: tempTree({}) };
  fs.writeFileSync(path.join(dir, 'r.md'), 'y'.repeat(9500 - envelopeSize));
  loadConfig(path.join(dir, 'noonsight.json'), noPreset);
  fs.writeFileSync(path.join(dir, 'r.md'), 'y'.repeat(9501 - envelopeSize));
  assert.throws(() => loadConfig(path.join(dir, 'noonsight.json'), noPreset), /come to 9501 characters/);
});

test('every schema problem is reported together', () => {
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

test('a refused preset is reported alone, without blaming user rules that name its scopes', () => {
  const missingSource = labPresetWith((p) => {
    delete p.models['claude-haiku-5-5'].rules[0].source;
  });
  const config = { version: 1, preset: 'lab', models: { 'claude-sonnet-5-5': { use: 'custom', add: [{ id: 'mine', file: 'mine.md', scopes: ['investigate'] }] } } };
  const problems = problemsOf(config, { 'mine.md': 'MINE' }, missingSource);
  assertProblem(problems, /missing required key "source"/);
  assert.ok(problems.every((p) => !/is not declared/.test(p)), problems.join('\n'));
});

test('an unused default preset that is not installed is not a problem', () => {
  const dir = tempTree({ 'noonsight.json': { version: 1, models: { 'claude-sonnet-5-5': { use: 'none' } } } });
  loadConfig(path.join(dir, 'noonsight.json'), { presetsDir: tempTree({}) });
});

test('scope matchers must be valid regular expressions and must not match every plain task text', () => {
  const problems = problemsOf({
    version: 1,
    scopes: { investigate: { match: ['\\binvestigat', '(unclosed', 'a*', '.', '\\b', '\\w', '\\bcat\\b'] } },
  });
  assertProblem(problems, /^\/scopes\/investigate\/match\/1: not a valid regular expression \(/);
  assertProblem(
    problems,
    /^\/scopes\/investigate\/match\/2: "a\*" matches each of the probe texts "a", "Z", "0", " a ", "A B", "x_1 y", which are plain task texts used to detect catch-all matchers$/,
  );
  assertProblem(problems, /^\/scopes\/investigate\/match\/3: "\." matches each of the probe texts/);
  assertProblem(problems, /^\/scopes\/investigate\/match\/4: "\\b" matches each of the probe texts/);
  assertProblem(problems, /^\/scopes\/investigate\/match\/5: "\\w" matches each of the probe texts/);
  assert.ok(!problems.some((p) => p.startsWith('/scopes/investigate/match/0')), problems.join('\n'));
  assert.ok(!problems.some((p) => p.startsWith('/scopes/investigate/match/6')), 'a narrow matcher is accepted');
  assertProblem(problemsOf({ version: 1, scopes: { empty: { match: [''] } } }), /^\/scopes\/empty\/match\/0: must not be empty/);
  assertProblem(problemsOf({ version: 1, scopes: { a: { match: ['x', 'x'] } } }), /^\/scopes\/a\/match: lists "x" more than once/);
});

test('unattended_when_env names environment variables, and a scope takes no agent_types key', () => {
  assertProblem(problemsOf({ version: 1, session: { unattended_when_env: ['CI', '1BAD'] } }), /^\/session\/unattended_when_env\/1: .*an environment variable name/);
  assertProblem(problemsOf({ version: 1, session: { delivery: 'off' } }), /^\/session\/delivery: unknown key$/);
  assertProblem(problemsOf({ version: 1, scopes: { a: { agent_types: ['Explore'] } } }), /^\/scopes\/a\/agent_types: unknown key$/);
  const ok = tempTree({ 'noonsight.json': { version: 1, session: { unattended_when_env: ['FM_TASK_ID'] } } });
  const cfg = loadConfig(path.join(ok, 'noonsight.json'), { presetsDir: LAB_PRESETS });
  assert.deepEqual(cfg.session.unattendedWhenEnv, ['FM_TASK_ID']);
});

test('the preset\'s matchers are checked with the preset, even when the user replaces them', () => {
  const bad = labPresetWith((p) => {
    p.scopes.investigate.match = ['(unclosed'];
  });
  const problems = problemsOf({ version: 1, preset: 'lab', scopes: { investigate: { match: ['\\bdiagnos'] } } }, {}, bad);
  assertProblem(problems, /^preset .*preset\.json: \/scopes\/investigate\/match\/0: not a valid regular expression/);
});

test('matchers with a catastrophic-backtracking shape are refused, naming the scope, the pattern and the shape found', () => {
  const problems = problemsOf({
    version: 1,
    scopes: {
      investigate: { match: ['.*investigat', '\\binvestigat'] },
      loop: { match: ['.*.*x', '(a+)+', '\\w+\\s*\\w+'] },
    },
  });
  assertProblem(
    problems,
    /^\/scopes\/investigate\/match\/0: scope "investigate": "\.\*investigat" starts with "\.\*", an unbounded repeat of any character with no "\^" and only parts that can match nothing before it, so matching retries it from every position of the task text; start with a word instead \(such as "\\binvestigat"\), or anchor it with "\^"$/,
  );
  assertProblem(problems, /^\/scopes\/loop\/match\/0: scope "loop": "\.\*\.\*x" starts with "\.\*", an unbounded repeat of any character/);
  assertProblem(problems, /^\/scopes\/loop\/match\/1: scope "loop": "\(a\+\)\+" has the unbounded quantifier "a\+" inside the unbounded quantifier "\(a\+\)\+", a shape whose matching time can grow exponentially with the task text$/);
  assertProblem(problems, /^\/scopes\/loop\/match\/2: scope "loop": "\\w\+\\s\*\\w\+" has the unbounded quantifiers "\\w\+" and "\\w\+" in a row, able to match the same characters with nothing required between them/);
  assert.ok(!problems.some((p) => p.startsWith('/scopes/investigate/match/1')), problems.join('\n'));
});

test('common matchers pass the backtracking check', () => {
  const dir = tempTree({
    'noonsight.json': {
      version: 1,
      scopes: {
        deploy: { match: ['\\bdeploy\\b', 'review|revis', '^fix\\b', '^.*hotfix', '\\b(?:summar(?:y|ize|ise)|digest)\\b', '\\w+\\s+investigat', 'foo.*bar', 'release[- ]notes?'] },
      },
    },
  });
  const cfg = loadConfig(path.join(dir, 'noonsight.json'), { presetsDir: LAB_PRESETS });
  assert.equal(cfg.scopes.get('deploy')?.match.length, 8);
});

test('the preset\'s matchers get the backtracking check too', () => {
  const bad = labPresetWith((p) => {
    p.scopes.investigate.match = ['(?:\\w+\\s?)*done'];
  });
  assertProblem(problemsOf({ version: 1, preset: 'lab' }, {}, bad), /^preset .*preset\.json: \/scopes\/investigate\/match\/0: scope "investigate": .* has the unbounded quantifier "\\w\+" inside the unbounded quantifier/);
});
