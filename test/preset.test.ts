// The preset the package ships (presets/claude): its rules, its sources, and the checks that keep a
// rule without a source, or one too long to deliver, out of it.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ConfigError, loadConfig, readPreset, type Preset } from '../src/config/load.js';
import { PACKAGE_ROOT } from '../src/config/paths.js';
import { resolve } from '../src/core/resolve.js';
import { RULES_TEXT_LIMIT } from '../src/core/types.js';
import { fakeClaude, runCli, tempTree } from './helpers.js';

const PRESETS = path.join(PACKAGE_ROOT, 'presets');
const SOURCES = fs.readFileSync(path.join(PRESETS, 'claude', 'SOURCES.md'), 'utf8');
const preset: Preset = readPreset('claude', { presetsDir: PRESETS });
const rules = [...preset.models.values()].flat();

/** A copy of the shipped preset in a temporary presets directory, with edits applied to its preset.json. */
function presetWith(edit: (p: Record<string, any>) => void): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-presets-'));
  fs.cpSync(PRESETS, dir, { recursive: true });
  const file = path.join(dir, 'claude', 'preset.json');
  const p = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, any>;
  edit(p);
  fs.writeFileSync(file, JSON.stringify(p, null, 2));
  return dir;
}

/** A configuration that declares every model of the preset with "use": "preset". */
function allPreset(extra: Record<string, unknown> = {}): string {
  const models = Object.fromEntries([...preset.models.keys()].map((k) => [k, { use: 'preset', ...extra }]));
  return path.join(tempTree({ 'sextant.json': { version: 1, preset: 'claude', models } }), 'sextant.json');
}

function problemsOf(presetsDir: string): readonly string[] {
  try {
    loadConfig(allPreset(), { presetsDir });
  } catch (e) {
    if (e instanceof ConfigError) return e.problems;
    throw e;
  }
  assert.fail('the configuration was accepted');
}

test('the preset ships 16 rules for the four current models and the five scopes', () => {
  assert.deepEqual([...preset.models.keys()], ['claude-fable-5-2', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']);
  assert.deepEqual([...preset.scopes.keys()], ['investigate', 'build', 'review', 'routine', 'digest']);
  assert.equal(rules.length, 16);
  // id: [scopes, places, on by default]
  const table = Object.fromEntries(rules.map((r) => [r.id, [r.scopes.join(' '), r.where.join(' '), r.enabled]]));
  assert.deepEqual(table, {
    'fable-5-2/finish-work': ['*', 'subagent', true],
    'fable-5-2/low-context-report': ['*', 'unattended subagent', true],
    'fable-5-2/code-ownership': ['build', 'session unattended', false],
    'fable-5-2/progress-updates': ['*', 'session', false],
    'opus-5-5/unattended-run': ['*', 'unattended', true],
    'opus-5-5/progress-updates': ['*', 'session', false],
    'opus-5-5/explore-before-acting': ['*', 'session unattended', false],
    'sonnet-5-5/carry-through': ['*', 'unattended subagent', true],
    'sonnet-5-5/stay-in-scope': ['routine', 'session unattended subagent', true],
    'sonnet-5-5/verify-changes': ['build routine', 'session unattended subagent', true],
    'sonnet-5-5/no-self-review-rounds': ['*', 'session unattended subagent', false],
    'sonnet-5-5/ideas-first': ['*', 'session', false],
    'sonnet-5-5/check-current-facts': ['digest', 'session unattended subagent', false],
    'haiku-5-5/carry-through': ['*', 'unattended subagent', true],
    'haiku-5-5/verify-changes': ['build routine', 'session unattended subagent', true],
    'haiku-5-5/search-recent-facts': ['digest', 'session unattended subagent', false],
  });
  for (const [model, list] of preset.models) assert.ok(list.some((r) => r.enabled && r.scopes.includes('*')), `${model} has a rule on for every scope`);
});

test('every rule and scope names a public source, a section and the date it was read; every rule an effect and a cost', () => {
  const hosts = new Set(['platform.claude.com', 'code.claude.com', 'www.anthropic.com']);
  for (const r of rules) {
    assert.ok(hosts.has(new URL(r.source.url).host), `${r.id}: ${r.source.url}`);
    assert.ok(r.source.section.trim(), r.id);
    assert.match(r.source.date, /^\d{4}-\d{2}-\d{2}$/, r.id);
    assert.ok(r.effect.trim() && r.cost.trim(), r.id);
    // Each model's rules come from that model's own prompting guide.
    const model = r.id.split('/')[0] ?? '';
    assert.equal(r.source.url, `https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-${model}`, r.id);
    assert.equal(r.file, `rules/${r.id}.md`);
  }
  for (const [name] of preset.scopes) {
    const source = preset.scopeSources.get(name);
    assert.ok(source && hosts.has(new URL(source.url).host) && source.section && source.date, name);
  }
  assert.deepEqual(preset.claudeCode?.version, '2.1.325');
});

test('SOURCES.md documents every rule and scope with the same source, effect and cost as the preset', () => {
  for (const r of rules) {
    const at = SOURCES.indexOf(`#### \`${r.id}\`\n`);
    assert.ok(at >= 0, `SOURCES.md has no section for ${r.id}`);
    const end = SOURCES.indexOf('\n#', at + 1);
    const section = SOURCES.slice(at, end === -1 ? undefined : end);
    for (const text of [r.source.url, `"${r.source.section}"`, r.source.date, r.effect, r.cost, r.enabled ? 'On by default' : 'Off by default'])
      assert.ok(section.includes(text), `SOURCES.md, ${r.id}: missing ${JSON.stringify(text)}`);
  }
  for (const [name] of preset.scopes) {
    const source = preset.scopeSources.get(name);
    const row = SOURCES.split('\n').find((l) => l.startsWith(`| \`${name}\` |`));
    assert.ok(row?.includes(source?.url ?? '?') && row.includes(`"${source?.section}"`), `SOURCES.md has no row for scope ${name} with its source`);
  }
});

test('the rule texts for Fable 5.2 never use "never", which that model reads as having no exception', () => {
  for (const r of preset.models.get('claude-fable-5-2') ?? []) assert.doesNotMatch(r.text, /\bnever\b/i, r.id);
});

test('with every rule on, every model, scope and place fits the delivery limit', () => {
  const config = loadConfig(allPreset(), { presetsDir: PRESETS });
  assert.ok(config.exact.size === 4);
  const everyRule = loadConfig(
    path.join(
      tempTree({
        'sextant.json': {
          version: 1,
          preset: 'claude',
          models: Object.fromEntries([...preset.models].map(([k, list]) => [k, { use: 'preset', enable: list.filter((r) => !r.enabled).map((r) => r.id) }])),
        },
      }),
      'sextant.json',
    ),
    { presetsDir: PRESETS },
  );
  for (const model of preset.models.keys())
    for (const scope of [null, ...preset.scopes.keys()])
      for (const place of ['session', 'unattended', 'subagent'] as const) {
        const d = resolve(everyRule, { model, scope, place });
        if (d.status === 'matched') assert.ok(d.text.length <= RULES_TEXT_LIMIT, `${model} ${scope} ${place}: ${d.text.length}`);
      }
});

test('as shipped, a model receives only the rules on by default, filtered by scope and place', () => {
  const config = loadConfig(allPreset(), { presetsDir: PRESETS });
  const ids = (model: string, scope: string | null, place: 'session' | 'unattended' | 'subagent'): readonly string[] => {
    const d = resolve(config, { model, scope, place });
    return d.status === 'matched' ? d.rules : [];
  };
  assert.deepEqual(ids('claude-fable-5-2', null, 'session'), []);
  assert.deepEqual(ids('claude-fable-5-2', null, 'subagent'), ['fable-5-2/finish-work', 'fable-5-2/low-context-report']);
  assert.deepEqual(ids('claude-fable-5-2', 'build', 'unattended'), ['fable-5-2/low-context-report']);
  assert.deepEqual(ids('claude-opus-5-5', null, 'unattended'), ['opus-5-5/unattended-run']);
  assert.deepEqual(ids('claude-opus-5-5', 'review', 'subagent'), []);
  assert.deepEqual(ids('claude-sonnet-5-5', 'routine', 'session'), ['sonnet-5-5/stay-in-scope', 'sonnet-5-5/verify-changes']);
  assert.deepEqual(ids('claude-sonnet-5-5', 'build', 'subagent'), ['sonnet-5-5/carry-through', 'sonnet-5-5/verify-changes']);
  assert.deepEqual(ids('claude-sonnet-5-5', 'digest', 'session'), []);
  assert.deepEqual(ids('claude-haiku-5-5', 'digest', 'subagent'), ['haiku-5-5/carry-through']);
  assert.deepEqual(ids('claude-haiku-5-5', 'routine', 'session'), ['haiku-5-5/verify-changes']);
});

test('a preset rule without a source, a section, a date, an effect or a cost is refused', () => {
  for (const key of ['source', 'effect', 'cost']) {
    const dir = presetWith((p) => {
      delete p.models['claude-opus-5-5'].rules[1][key];
    });
    assert.ok(
      problemsOf(dir).some((p) => p.includes(`/models/claude-opus-5-5/rules/1: missing required key "${key}"`)),
      key,
    );
  }
  for (const key of ['url', 'section', 'date']) {
    const dir = presetWith((p) => {
      delete p.models['claude-opus-5-5'].rules[1].source[key];
    });
    assert.ok(problemsOf(dir).some((p) => p.includes(`/models/claude-opus-5-5/rules/1/source: missing required key "${key}"`)), key);
  }
  const noScopeSource = presetWith((p) => {
    delete p.scopes.digest.source;
  });
  assert.ok(problemsOf(noScopeSource).some((p) => p.includes('/scopes/digest: missing required key "source"')));
});

test('a preset rule over the size limit is refused even while it is off, and so is a set of rules that only overflows with every rule on', () => {
  const huge = presetWith((p) => {
    p.models['claude-opus-5-5'].rules[2].enabled = false;
  });
  fs.writeFileSync(path.join(huge, 'claude', 'rules', 'opus-5-5', 'explore-before-acting.md'), 'x'.repeat(RULES_TEXT_LIMIT));
  const problems = problemsOf(huge);
  assert.ok(
    problems.some((p) =>
      /preset \.*.*preset\.json: \/models\/claude-opus-5-5\/rules\/2\/file: rule "opus-5-5\/explore-before-acting" comes to \d+ characters on its own, envelope included; the limit is 9500/.test(p),
    ),
    problems.join('\n'),
  );

  // Two rules that are off, each fitting on its own, that only overflow together.
  const together = presetWith(() => {});
  for (const name of ['progress-updates', 'explore-before-acting'])
    fs.writeFileSync(path.join(together, 'claude', 'rules', 'opus-5-5', `${name}.md`), 'y'.repeat(5000));
  const both = problemsOf(together);
  assert.ok(
    both.some((p) => /\/models\/claude-opus-5-5: with every rule on, the rules delivered for no scope in place "session" come to \d+ characters; the limit is 9500/.test(p)),
    both.join('\n'),
  );
});

test('sextant check refuses a preset rule without a source, and one over the size limit', () => {
  const run = (presetsDir: string) =>
    runCli(['check'], { SEXTANT_CONFIG: allPreset(), SEXTANT_PRESETS_DIR: presetsDir, SEXTANT_SYSTEM_ROOT: tempTree({}), PATH: fakeClaude('2.1.325') });

  const ok = run(PRESETS);
  assert.match(ok.stdout, /^ok: config .*: valid \(4 model entries;/m, ok.stdout);
  assert.match(ok.stdout, /^ok: scopes: 5 scopes declared, 0 matchers$/m, ok.stdout);

  const noSource = run(
    presetWith((p) => {
      delete p.models['claude-fable-5-2'].rules[0].source;
    }),
  );
  assert.equal(noSource.status, 2, noSource.stdout);
  assert.match(noSource.stdout, /^problem: config .*: refused, so sessions get no rules:/m);
  assert.match(noSource.stdout, /preset .*preset\.json: \/models\/claude-fable-5-2\/rules\/0: missing required key "source"/);

  const big = presetWith(() => {});
  fs.writeFileSync(path.join(big, 'claude', 'rules', 'fable-5-2', 'code-ownership.md'), 'z'.repeat(RULES_TEXT_LIMIT));
  const tooLong = run(big);
  assert.equal(tooLong.status, 2, tooLong.stdout);
  assert.match(tooLong.stdout, /rule "fable-5-2\/code-ownership" comes to \d+ characters on its own/);
});
