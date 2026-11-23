// Scope and place: where a decision's scope and place come from, how a task picks its scope, and
// which scopes overlap. Pure core functions over configurations loaded from temporary directories.

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { loadConfig } from '../src/config/load.js';
import { scopeOverlaps } from '../src/core/overlap.js';
import { regexSamples } from '../src/core/regex-sample.js';
import { backtrackingRisk } from '../src/core/backtracking.js';
import { resolve } from '../src/core/resolve.js';
import { sessionPlace, sessionScope, taskScope, taskText } from '../src/core/scope.js';
import { MATCHER_FLAGS, type Config, type Decision, type MatchedDecision } from '../src/core/types.js';
import { LAB_PRESETS, labPresetWith, tempTree } from './helpers.js';

const matched = (d: Decision): MatchedDecision => {
  assert.equal(d.status, 'matched', JSON.stringify(d));
  return d as MatchedDecision;
};

function load(config: Record<string, unknown>, files: Record<string, string> = {}, presetsDir = LAB_PRESETS): Config {
  const dir = tempTree({ 'noonsight.json': { version: 1, ...config }, ...files });
  return loadConfig(path.join(dir, 'noonsight.json'), { presetsDir });
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
const scopeOf = (cfg: Config, prompt: string, description: string | null = null): string | null => taskScope(cfg, taskText(description, prompt).text).scope;

test('scope: two scopes on the same model deliver different rules, and no scope delivers only the general ones', () => {
  const cfg = scoped();
  const rules = (scope: string | null): readonly string[] => matched(resolve(cfg, { model: 'claude-sonnet-5-5', scope, place: 'attended' })).rules;
  assert.deepEqual(rules('investigate'), ['general', 'investigate']);
  assert.deepEqual(rules('summarize'), ['general', 'summarize']);
  assert.deepEqual(rules(null), ['general']);
  const a = matched(resolve(cfg, { model: 'claude-sonnet-5-5', scope: 'investigate', place: 'attended' }));
  const b = matched(resolve(cfg, { model: 'claude-sonnet-5-5', scope: 'summarize', place: 'attended' }));
  assert.notEqual(a.sha256, b.sha256);
  assert.match(a.text, /INVESTIGATE-2000/);
  assert.doesNotMatch(a.text, /SUMMARIZE-3000/);
});

test('session scope: NOONSIGHT_SCOPE names it, trimmed; unset or empty means none', () => {
  assert.deepEqual(sessionScope({ NOONSIGHT_SCOPE: 'investigate' }), { scope: 'investigate', source: 'env' });
  assert.deepEqual(sessionScope({ NOONSIGHT_SCOPE: '  summarize\n' }), { scope: 'summarize', source: 'env' });
  assert.deepEqual(sessionScope({ NOONSIGHT_SCOPE: ' ' }), { scope: null, source: null });
  assert.deepEqual(sessionScope({}), { scope: null, source: null });
});

test('session scope: an undeclared NOONSIGHT_SCOPE only means the general rules, never a warning', () => {
  const cfg = scoped();
  const d = matched(resolve(cfg, { model: 'claude-sonnet-5-5', scope: sessionScope({ NOONSIGHT_SCOPE: 'release' }).scope, place: 'attended' }));
  assert.equal(d.scope, null);
  assert.deepEqual(d.rules, ['general']);
  assert.equal(d.unknown_scope, 'release');
});

test('session place: unattended when a variable of session.unattended_when_env is set and not empty', () => {
  const cfg = scoped({ session: { unattended_when_env: ['CI', 'FM_TASK_ID'] } });
  assert.deepEqual(sessionPlace(cfg, {}), { place: 'attended' });
  assert.deepEqual(sessionPlace(cfg, { CI: '' }), { place: 'attended' });
  assert.deepEqual(sessionPlace(cfg, { FM_TASK_ID: 'task-7' }), { place: 'unattended', because: 'env', env: 'FM_TASK_ID' });
  assert.deepEqual(sessionPlace(cfg, { CI: 'true', FM_TASK_ID: 'x' }), { place: 'unattended', because: 'env', env: 'CI' }, 'the first one listed is named');
  assert.deepEqual(sessionPlace(scoped(), { CI: 'true' }), { place: 'attended' }, 'no variable is listed by default');

  const rules = (env: Record<string, string>): readonly string[] =>
    matched(resolve(cfg, { model: 'claude-sonnet-5-5', scope: null, place: sessionPlace(cfg, env).place })).rules;
  assert.deepEqual(rules({}), ['general']);
  assert.deepEqual(rules({ CI: '1' }), ['general', 'unattended']);
});

test('session place: a headless run, which Claude Code marks with CLAUDE_CODE_SESSION_ATTENDED=0, is unattended unless session.headless_is_unattended is false', () => {
  const cfg = scoped();
  assert.equal(cfg.session.headlessIsUnattended, true, 'on by default');
  assert.deepEqual(sessionPlace(cfg, { CLAUDE_CODE_SESSION_ATTENDED: '0' }), { place: 'unattended', because: 'headless' });
  // Anything but "0", the variable missing included, is not headless: a Claude Code that drops or renames
  // the variable leaves every session where it was before noonsight read it.
  for (const value of [undefined, '1', '', 'false', 'no', ' 0', '00'])
    assert.deepEqual(sessionPlace(cfg, { CLAUDE_CODE_SESSION_ATTENDED: value }), { place: 'attended' }, `CLAUDE_CODE_SESSION_ATTENDED=${String(value)}`);
  // The entry point alone says nothing: an IDE or the desktop app reports another one for a watched session.
  assert.deepEqual(sessionPlace(cfg, { CLAUDE_CODE_ENTRYPOINT: 'sdk-cli' }), { place: 'attended' });
  assert.deepEqual(sessionPlace(cfg, { CLAUDE_CODE_ENTRYPOINT: 'claude-vscode', CLAUDE_CODE_SESSION_ATTENDED: '1' }), { place: 'attended' });
  // The caller may know better than the environment, as the launcher does for the session it starts.
  assert.deepEqual(sessionPlace(cfg, { CLAUDE_CODE_SESSION_ATTENDED: '1' }, true), { place: 'unattended', because: 'headless' });
  assert.deepEqual(sessionPlace(cfg, { CLAUDE_CODE_SESSION_ATTENDED: '0' }, false), { place: 'attended' });

  const both = scoped({ session: { unattended_when_env: ['CI'] } });
  assert.deepEqual(sessionPlace(both, { CI: '1', CLAUDE_CODE_SESSION_ATTENDED: '0' }), { place: 'unattended', because: 'env', env: 'CI' }, 'a variable of the configuration is named first');

  const off = scoped({ session: { unattended_when_env: ['CI'], headless_is_unattended: false } });
  assert.deepEqual(sessionPlace(off, { CLAUDE_CODE_SESSION_ATTENDED: '0' }), { place: 'attended' });
  assert.deepEqual(sessionPlace(off, { CI: '1', CLAUDE_CODE_SESSION_ATTENDED: '0' }), { place: 'unattended', because: 'env', env: 'CI' }, 'unattended_when_env still works');

  const rules = (c: Config, env: Record<string, string>): readonly string[] =>
    matched(resolve(c, { model: 'claude-sonnet-5-5', scope: null, place: sessionPlace(c, env).place })).rules;
  assert.deepEqual(rules(cfg, { CLAUDE_CODE_SESSION_ATTENDED: '0' }), ['general', 'unattended']);
  assert.deepEqual(rules(off, { CLAUDE_CODE_SESSION_ATTENDED: '0' }), ['general']);
});

test('task scope: the matcher that matches earliest in the text wins, case-insensitively', () => {
  const cfg = scoped();
  assert.deepEqual(taskScope(cfg, taskText(null, 'Find the ROOT CAUSE of the failure.').text), {
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
  assert.equal(taskText('a', 'b').text, 'a\n\nb');
  assert.equal(taskText(null, 'b').text, 'b');
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
    const source = { url: 'https://example.com/lab/scopes', section: 'Scopes', date: '2026-11-14' };
    p.scopes.investigate = { description: 'Preset description.', match: ['\\binvestigat'], source };
    p.scopes.review = { description: 'Preset review.', match: ['\\breview'], source };
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
  const envelope = '<noonsight-rules model="claude-sonnet-5-5" scope="investigate">\nInvestigate with care.\n</noonsight-rules>';
  assert.equal(scopeOf(cfg, `Rename the variable.\n\n${envelope}`), null);
  assert.equal(scopeOf(cfg, `${envelope}\n\nSummarize the log.`), 'summarize');
  const note = '<noonsight-rules-change from="a" to="b">\nThe digest no longer applies.\n</noonsight-rules-change>';
  assert.equal(scopeOf(cfg, `${note} Rename it.`), null);
});

test('task scope: a matcher that matches only at the very end of a 100,000-character task picks the scope', () => {
  const cfg = scoped();
  const word = ' investigate';
  const filler = 'The function reads the file and writes the result. ';
  const body = filler.repeat(Math.ceil((100_000 - word.length) / filler.length)).slice(0, 100_000 - word.length);
  const task = `${body}${word}`;
  assert.equal(task.length, 100_000);
  assert.equal(scopeOf(cfg, body), null, 'the filler matches no scope');
  assert.deepEqual(taskScope(cfg, taskText(null, task).text), { scope: 'investigate', source: 'task-text', matcher: '\\binvestigat' });
  assert.equal(taskText(null, task).cut, false);
});

test('task scope: a match past the 100,000th character is not read, and the task is marked cut', () => {
  const cfg = scoped();
  const filler = 'The function reads the file and writes the result. ';
  const body = filler.repeat(Math.ceil(100_000 / filler.length)).slice(0, 100_000);
  const task = `${body} Then investigate`;
  assert.ok(task.length > 100_000);
  assert.deepEqual(taskScope(cfg, taskText(null, task).text), { scope: null, source: null });
  assert.equal(taskText(null, task).cut, true);
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

test('backtracking shapes: a leading unbounded repeat of any character, nested unbounded quantifiers, and overlapping ones in a row', () => {
  const kind = (p: string): string | null => backtrackingRisk(p, MATCHER_FLAGS)?.kind ?? null;
  for (const p of ['.*investigat', '.+x', '[\\s\\S]*x', '(?:.|\\n)*x', 'foo|.*bar', '\\b.*x']) assert.equal(kind(p), 'leading-any', p);
  // Parts that can match nothing do not anchor the repeat after them, and a lookaround opens its own alternatives.
  for (const p of ['a?.*x', '(?:foo)?.*x', '\\s?.*x', '(?:.*x)?y', '(?=.*.*x)', '(?=.*deploy)(?=.*prod)', '(?<=.*x)y', '(?:^|\\s).*x', '(^\\s*)?.*x', '(?!^).*x', '(?<!^).*x']) assert.equal(kind(p), 'leading-any', p);
  // A "^" inside a group or lookaround still anchors what follows it.
  assert.equal(kind('(?:^\\s*).*hotfix'), 'adjacent', 'anchored, so only the repeats in a row are reported');
  for (const p of ['(a+)+', '(a*)*', '(?:\\w+\\s?)*x', '(?:x(?:ab)+)*', '^(?=(a+)+x)']) assert.equal(kind(p), 'nested', p);
  for (const p of ['^.*.*x', '\\w+\\w+', '\\w+\\s*\\w+', 'a+(?:b?)a*', '^(?=.*.*x)', '\\w+(?:-|\\w+)', '(?:-|\\w+)\\w+', '\\w+(?:x\\w+)?\\w+']) assert.equal(kind(p), 'adjacent', p);
  assert.equal(kind('.*.*x'), 'leading-any', 'the first shape found is reported');
  const common = ['\\bdeploy\\b', 'review|revis', '^fix\\b', '^.*hotfix', '(?:^).*x', '(?=^).*x', '(?:^\\s?).*hotfix', '^(?=.*deploy)(?=.*prod)', '\\s?fix\\b', 'foo.*bar', '\\binvestigat', '\\w+\\s+investigat', '\\d+\\.\\d+', 'x+y+', 'a.*b.*c', '(ab|cd){2}e', '(a+){2}', 'change\\s*log'];
  for (const p of common) assert.equal(kind(p), null, p);
  assert.equal(kind('(unclosed'), null, 'an unreadable pattern is never reported');
});

test('the listed matchers that pass the backtracking check run fast over 100,000 characters of prose they do not match', () => {
  const filler = 'The function reads the file and writes the result. ';
  const text = filler.repeat(Math.ceil(100_000 / filler.length)).slice(0, 100_000);
  const accepted = ['\\bdeploy\\b', 'review|revis', '^fix\\b', '\\binvestigat', '\\w+\\s+investigat', '\\b(?:summar(?:y|ize|ise)|digest)\\b'];
  const cfg = load({ scopes: { a: { match: accepted } } });
  const started = process.hrtime.bigint();
  for (let i = 0; i < 10; i++) assert.equal(taskScope(cfg, taskText(null, text).text).scope, null);
  const perCall = Number(process.hrtime.bigint() - started) / 10 / 1e6;
  // A generous ceiling: the point is that time stays small, not a benchmark.
  assert.ok(perCall < 250, `one scope decision took ${perCall.toFixed(1)} ms`);
});
