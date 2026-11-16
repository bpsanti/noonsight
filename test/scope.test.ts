// Scope and place: where a decision's scope and place come from, how a task picks its scope, and
// which scopes overlap. Pure core functions over configurations loaded from temporary directories.

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { loadConfig } from '../src/config/load.js';
import { scopeOverlaps } from '../src/core/overlap.js';
import { regexSamples } from '../src/core/regex-sample.js';
import { resolve } from '../src/core/resolve.js';
import { sessionPlace, sessionScope, taskScope, taskText } from '../src/core/scope.js';
import { MATCHER_FLAGS, type Config, type Decision, type MatchedDecision } from '../src/core/types.js';
import { LAB_PRESETS, labPresetWith, tempTree } from './helpers.js';

const matched = (d: Decision): MatchedDecision => {
  assert.equal(d.status, 'matched', JSON.stringify(d));
  return d as MatchedDecision;
};

function load(config: Record<string, unknown>, files: Record<string, string> = {}, presetsDir = LAB_PRESETS): Config {
  const dir = tempTree({ 'sextant.json': { version: 1, ...config }, ...files });
  return loadConfig(path.join(dir, 'sextant.json'), { presetsDir });
}

/** Sonnet with one rule for every scope and one rule each for two scopes, in every place. */
const RULES = {
  'general.md': 'GENERAL-1000',
  'investigate.md': 'INVESTIGATE-2000',
  'summarize.md': 'SUMMARIZE-3000',
  'unattended.md': 'UNATTENDED-4000',
};
const SONNET = {
  'claude-sonnet-5-5': {
    use: 'custom',
    add: [
      { id: 'general', file: 'general.md' },
      { id: 'investigate', file: 'investigate.md', scopes: ['investigate'] },
      { id: 'summarize', file: 'summarize.md', scopes: ['summarize'] },
      { id: 'unattended', file: 'unattended.md', where: ['unattended'] },
    ],
  },
};
const SCOPES = {
  investigate: { match: ['\\binvestigat', '\\broot cause\\b'] },
  summarize: { match: ['\\bsummar', '\\bdigest\\b'] },
};
const scoped = (extra: Record<string, unknown> = {}): Config => load({ models: SONNET, scopes: SCOPES, ...extra }, RULES);
const scopeOf = (cfg: Config, prompt: string, description: string | null = null): string | null => taskScope(cfg, { description, prompt }).scope;

test('scope: two scopes on the same model deliver different rules, and no scope delivers only the general ones', () => {
  const cfg = scoped();
  const rules = (scope: string | null): readonly string[] => matched(resolve(cfg, { model: 'claude-sonnet-5-5', scope, place: 'session' })).rules;
  assert.deepEqual(rules('investigate'), ['general', 'investigate']);
  assert.deepEqual(rules('summarize'), ['general', 'summarize']);
  assert.deepEqual(rules(null), ['general']);
  const a = matched(resolve(cfg, { model: 'claude-sonnet-5-5', scope: 'investigate', place: 'session' }));
  const b = matched(resolve(cfg, { model: 'claude-sonnet-5-5', scope: 'summarize', place: 'session' }));
  assert.notEqual(a.sha256, b.sha256);
  assert.match(a.text, /INVESTIGATE-2000/);
  assert.doesNotMatch(a.text, /SUMMARIZE-3000/);
});

test('session scope: SEXTANT_SCOPE names it, trimmed; unset or empty means none', () => {
  assert.deepEqual(sessionScope({ SEXTANT_SCOPE: 'investigate' }), { scope: 'investigate', source: 'env' });
  assert.deepEqual(sessionScope({ SEXTANT_SCOPE: '  summarize\n' }), { scope: 'summarize', source: 'env' });
  assert.deepEqual(sessionScope({ SEXTANT_SCOPE: ' ' }), { scope: null, source: null });
  assert.deepEqual(sessionScope({}), { scope: null, source: null });
});

test('session scope: an undeclared SEXTANT_SCOPE only means the general rules, never a warning', () => {
  const cfg = scoped();
  const d = matched(resolve(cfg, { model: 'claude-sonnet-5-5', scope: sessionScope({ SEXTANT_SCOPE: 'release' }).scope, place: 'session' }));
  assert.equal(d.scope, null);
  assert.deepEqual(d.rules, ['general']);
  assert.equal(d.unknown_scope, 'release');
});

test('session place: unattended when a variable of session.unattended_when_env is set and not empty', () => {
  const cfg = scoped({ session: { unattended_when_env: ['CI', 'FM_TASK_ID'] } });
  assert.deepEqual(sessionPlace(cfg, {}), { place: 'session' });
  assert.deepEqual(sessionPlace(cfg, { CI: '' }), { place: 'session' });
  assert.deepEqual(sessionPlace(cfg, { FM_TASK_ID: 'task-7' }), { place: 'unattended', because: 'FM_TASK_ID' });
  assert.deepEqual(sessionPlace(cfg, { CI: 'true', FM_TASK_ID: 'x' }), { place: 'unattended', because: 'CI' }, 'the first one listed is named');
  assert.deepEqual(sessionPlace(scoped(), { CI: 'true' }), { place: 'session' }, 'no variable is listed by default');

  const rules = (env: Record<string, string>): readonly string[] =>
    matched(resolve(cfg, { model: 'claude-sonnet-5-5', scope: null, place: sessionPlace(cfg, env).place })).rules;
  assert.deepEqual(rules({}), ['general']);
  assert.deepEqual(rules({ CI: '1' }), ['general', 'unattended']);
});

test('task scope: the matcher that matches earliest in the text wins, case-insensitively', () => {
  const cfg = scoped();
  assert.deepEqual(taskScope(cfg, { prompt: 'Find the ROOT CAUSE of the failure.' }), {
    scope: 'investigate',
    source: 'task-text',
    matcher: '\\broot cause\\b',
  });
  assert.equal(scopeOf(cfg, 'Summarize what you find while you investigate.'), 'summarize');
  assert.equal(scopeOf(cfg, 'Investigate, then summarize.'), 'investigate');
  assert.equal(scopeOf(cfg, 'Rename the variable.'), null);
  assert.equal(scopeOf(cfg, 'reinvestigate'), null, 'a word boundary in the matcher holds');
  assert.equal(scopeOf(load({ scopes: { analysis: { match: ['análise'] } } }), 'ANÁLISE do log'), 'analysis', 'case folds beyond ASCII');
});

test('task scope: the description is read before the task text', () => {
  const cfg = scoped();
  assert.equal(scopeOf(cfg, 'Investigate the logs and write it up.', 'Summarize release logs'), 'summarize');
  assert.equal(scopeOf(cfg, 'Investigate the logs.', 'Read logs'), 'investigate');
  assert.equal(taskText('a', 'b'), 'a\n\nb');
  assert.equal(taskText(null, 'b'), 'b');
});

test('task scope: two scopes that match at the same place go to the one declared first, the preset\'s before the user\'s', () => {
  const both = { first: { match: ['\\bcheck'] }, second: { match: ['\\bcheck the'] } };
  assert.equal(scopeOf(load({ scopes: both }), 'check the build'), 'first');
  assert.equal(scopeOf(load({ scopes: { second: both.second, first: both.first } }), 'check the build'), 'second');

  const presets = labPresetWith((p) => {
    p.scopes.investigate.match = ['\\bcheck'];
  });
  const cfg = load({ preset: 'lab', scopes: { audit: { match: ['\\bcheck'] } } }, {}, presets);
  assert.deepEqual([...cfg.scopes.keys()], ['investigate', 'audit']);
  assert.equal(scopeOf(cfg, 'check the build'), 'investigate');
});

test('task scope: a user scope named like a preset scope keeps its place and replaces only the keys it gives', () => {
  const presets = labPresetWith((p) => {
    p.scopes.investigate = { description: 'Preset description.', match: ['\\binvestigat'] };
    p.scopes.review = { match: ['\\breview'] };
  });
  const cfg = load({ preset: 'lab', scopes: { audit: { match: ['\\baudit'] }, investigate: { match: ['\\bdiagnos'] } } }, {}, presets);
  assert.deepEqual([...cfg.scopes.keys()], ['investigate', 'review', 'audit']);
  const investigate = cfg.scopes.get('investigate');
  assert.equal(investigate?.description, 'Preset description.');
  assert.deepEqual(investigate?.match.map((m) => m.source), ['\\bdiagnos']);
  assert.equal(scopeOf(cfg, 'investigate this'), null);
  assert.equal(scopeOf(cfg, 'diagnose this'), 'investigate');
});

test('task scope: rules a parent copied into the task do not pick the scope', () => {
  const cfg = scoped();
  const envelope = '<sextant-rules model="claude-sonnet-5-5" scope="investigate">\nInvestigate with care.\n</sextant-rules>';
  assert.equal(scopeOf(cfg, `Rename the variable.\n\n${envelope}`), null);
  assert.equal(scopeOf(cfg, `${envelope}\n\nSummarize the log.`), 'summarize');
  const note = '<sextant-rules-change from="a" to="b">\nThe digest no longer applies.\n</sextant-rules-change>';
  assert.equal(scopeOf(cfg, `${note} Rename it.`), null);
});

test('task scope: the whole task text is read, so a matcher that matches only at the end of a 100,000-character task picks the scope', () => {
  const cfg = scoped();
  const filler = 'The function reads the file and writes the result. ';
  const body = filler.repeat(Math.ceil(100_000 / filler.length)).slice(0, 100_000);
  assert.equal(scopeOf(cfg, body), null, 'the filler matches no scope');
  const task = `${body} Then investigate`;
  assert.ok(task.length > 100_000);
  assert.deepEqual(taskScope(cfg, { prompt: task }), { scope: 'investigate', source: 'task-text', matcher: '\\binvestigat' });
});

test('task scope: a configuration with no matchers gives every subagent no scope', () => {
  assert.equal(scopeOf(load({ scopes: { investigate: {} } }), 'Investigate the root cause.'), null);
});

test('example texts: each one matches its expression, for the syntax matchers use', () => {
  const patterns = [
    '\\binvestigat',
    '\\broot cause\\b',
    '\\b(?:summar(?:y|ize|ise)|digest)\\b',
    'release[- ]notes?',
    '^fix\\b',
    '\\bv\\d+\\.\\d+',
    '[A-Z]{2,4}-\\d{1,5}',
    'change\\s*log',
    '[^a-z]todo',
    '(?<!re)write',
    'review(?= the)',
    '\\p{L}+ report',
    'caf\\u00e9|\\x41BC',
    'a.c',
    '(ab|cd){2}e',
  ];
  for (const p of patterns) {
    const { texts } = regexSamples(p, MATCHER_FLAGS);
    assert.ok(texts.length > 0, `no example for ${p}`);
    const regex = new RegExp(p, MATCHER_FLAGS);
    for (const s of texts) assert.ok(regex.test(s), `${JSON.stringify(s)} does not match ${p}`);
  }
  assert.ok(regexSamples('\\b(?:summar(?:y|ize|ise)|digest)\\b', MATCHER_FLAGS).texts.map((s) => s.trim()).includes('digest'));
  assert.deepEqual(regexSamples('(a)\\1', MATCHER_FLAGS), { texts: [], complete: false }, 'a back reference gives no example');
});

test('example texts: a matcher whose every example fits is complete, and one with more than the limit is not', () => {
  assert.deepEqual(regexSamples('\\bcat\\b', MATCHER_FLAGS), { texts: ['cat'], complete: true });
  const words = Array.from({ length: 24 }, (_, i) => `w${String(i).padStart(2, '0')}`);
  const cut = regexSamples(`\\b(?:${[...words, 'zeta'].join('|')})\\b`, MATCHER_FLAGS);
  assert.equal(cut.complete, false, 'zeta is the 25th alternative, past the limit');
  assert.equal(cut.texts.length, 24);
});

test('overlaps: a text one scope matches that another scope also matches, with the scope it goes to', () => {
  const cfg = load({
    scopes: {
      investigate: { match: ['\\bdiagnos', '\\broot cause\\b'] },
      triage: { match: ['\\bdiagnosis\\b'] },
      summarize: { match: ['\\bsummar'] },
    },
  });
  const report = scopeOverlaps(cfg);
  assert.deepEqual(report.overlaps, [{ scopes: ['investigate', 'triage'], text: 'diagnosis', winner: 'investigate' }]);
  assert.equal(report.matchers, 4);
  assert.deepEqual(report.untested, []);
});

test('overlaps: a text that only the later scope\'s examples reach is still found', () => {
  const cfg = load({ scopes: { wide: { match: ['notes'] }, narrow: { match: ['\\brelease notes\\b'] } } });
  assert.deepEqual(scopeOverlaps(cfg).overlaps, [{ scopes: ['wide', 'narrow'], text: 'release notes', winner: 'narrow' }]);
});

test('overlaps: the reported text is the exact text both scopes match, not a trimmed copy of it', () => {
  const cfg = load({ scopes: { after: { match: ['(?<= )x'] }, anywhere: { match: ['x'] } } });
  const overlap = scopeOverlaps(cfg).overlaps[0];
  assert.equal(overlap?.text, ' x');
  assert.ok(new RegExp('(?<= )x', MATCHER_FLAGS).test(overlap?.text ?? ''), 'the reported text matches the first scope');
});

test('overlaps: scopes that never match the same text, and a matcher that cannot be tested', () => {
  const cfg = load({ scopes: { a: { match: ['\\bcat\\b', '(x)\\1'] }, b: { match: ['\\bcatalog\\b'] } } });
  const report = scopeOverlaps(cfg);
  assert.deepEqual(report.overlaps, []);
  assert.deepEqual(report.untested, [{ scope: 'a', matcher: '(x)\\1' }]);
});

test('overlaps: a matcher whose examples are cut short is untested, so no overlap is claimed for it', () => {
  const words = Array.from({ length: 24 }, (_, i) => `w${String(i).padStart(2, '0')}`);
  const source = `\\b(?:${[...words, 'zeta'].join('|')})\\b`;
  const cfg = load({ scopes: { a: { match: [source] }, b: { match: ['\\bz[a-z]{3}\\b'] } } });
  const report = scopeOverlaps(cfg);
  assert.deepEqual(report.overlaps, [], 'the examples of a do not reach zeta');
  assert.deepEqual(report.untested, [{ scope: 'a', matcher: source }]);
});

test('overlaps: a repeat range wider than two counts makes its matchers untested, since a shared text can need another count', () => {
  const a = '^x{3,5}y{1,5}$';
  const b = '^x{1,5}y{3,5}$';
  assert.ok(new RegExp(a, MATCHER_FLAGS).test('xxxyyy') && new RegExp(b, MATCHER_FLAGS).test('xxxyyy'), 'xxxyyy is a shared text');
  const report = scopeOverlaps(load({ scopes: { a: { match: [a] }, b: { match: [b] } } }));
  assert.deepEqual(report.untested, [
    { scope: 'a', matcher: a },
    { scope: 'b', matcher: b },
  ]);
});

test('overlaps: two scopes that accept the same character of a class overlap, with that character as the text', () => {
  const cfg = load({ scopes: { a: { match: ['^[qz]$'] }, b: { match: ['^[xz]$'] } } });
  const [overlap] = scopeOverlaps(cfg).overlaps;
  assert.deepEqual(overlap?.scopes, ['a', 'b']);
  assert.ok(/^[qz]$/iu.test(overlap?.text ?? '') && /^[xz]$/iu.test(overlap?.text ?? ''), 'the reported text matches both scopes');
});
