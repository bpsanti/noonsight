// The delivery benchmark (experiments/delivery), on written inputs: the generator, the stub's replies,
// the oracle, the shrinker, the measures, the decision log replay, the plants and the corpus files. No
// Claude Code session runs here; test/live/delivery-corpus.test.ts runs the corpus for real.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { evaluate, pair, readDesign, renderComparison, type Design, type Folder } from '../experiments/delivery/compare.js';
import { check, readCorpus, type Entry } from '../experiments/delivery/corpus.js';
import { failed, fuzzRuns, knownReason, sessionKey, signature, violationsOf, type Line } from '../experiments/delivery/fuzz.js';
import { generate, hasQuietPair, show, valid, type Sequence } from '../experiments/delivery/generate.js';
import { agree, aggregate, replay, ruleLibrary } from '../experiments/delivery/log-measure.js';
import { measure, pathOf, renderMarkdown } from '../experiments/delivery/measure.js';
import { configFor, inspect, kindOf, loadReference, MODELS, type Fact } from '../experiments/delivery/oracle.js';
import { comparePlant, occurrences, PLANTS } from '../experiments/delivery/plants.js';
import type { RequestFact, Run } from '../experiments/delivery/session.js';
import { shrink } from '../experiments/delivery/shrink.js';
import { reply } from '../experiments/delivery/stub.js';
import { PACKAGE_ROOT } from '../src/config/paths.js';
import { resolve, switchNote } from '../src/core/resolve.js';

const ref = loadReference(fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-delivery-test-')));
const TOOLS = [{ name: 'Agent' }, { name: 'Read' }];

/** The text of each right rule of a model in an unattended session with no scope. */
function rulesOf(model: string): string[] {
  const d = resolve(ref.config, { model, scope: null, place: 'unattended' });
  assert.equal(d.status, 'matched', `${model} has rules for an unattended session`);
  return d.status === 'matched' ? d.rules.map((id) => ref.byId.get(id)?.text ?? '') : [];
}

function body(model: string, system: string, user = 'DB 0 turn'): Record<string, unknown> {
  return { model, system, tools: TOOLS, messages: [{ role: 'user', content: [{ type: 'text', text: user }] }], metadata: { user_id: JSON.stringify({ session_id: 's1' }) } };
}

const where = { scope: null, place: 'unattended' as const, triggers: [] };

test('generator: a seed always gives the same sequences, and every one can be driven', () => {
  for (let i = 0; i < 300; i++) {
    const s = generate(1, i);
    assert.deepEqual(s, generate(1, i));
    assert.ok(valid(s), show(s));
    assert.equal(s.steps.at(-1)?.k, 'turn');
    assert.ok(s.steps.length >= 3 && s.steps.length <= 13);
  }
  // The sequences the published results come from: a change to the generator must not change them.
  assert.equal(show(generate(1, 170)), 'start(haiku, scope=none, unattended) > edit(code) > /clear > turn > /model sonnet > /model fable > turn');
  assert.equal(show(generate(1, 96)), 'start(fable, scope=none, unattended) > turn > /compact > resume > turn > turn > /model haiku > turn');
  assert.notDeepEqual(generate(1, 0), generate(2, 0));
});

test('generator: valid() refuses what cannot be driven', () => {
  const s = (steps: Sequence['steps']): Sequence => ({ model: 'haiku', scope: null, unattended: true, steps });
  assert.equal(valid(s([{ k: 'compact' }, { k: 'turn' }])), false, 'compaction needs a turn first');
  assert.equal(valid(s([{ k: 'turn' }, { k: 'clear' }, { k: 'resume', model: null }])), false, 'a resume needs a turn since /clear');
  assert.equal(valid(s([{ k: 'model', to: 'haiku' }])), false, 'a switch to the current model');
  assert.equal(valid(s([{ k: 'turn' }, { k: 'resume', model: 'opus' }, { k: 'model', to: 'opus' }])), false, 'the resume moved the session to Opus');
  assert.equal(valid(s([])), false);
  assert.equal(valid(s([{ k: 'model', to: 'sonnet' }, { k: 'model', to: 'fable' }])), true);
  assert.equal(hasQuietPair(s([{ k: 'model', to: 'sonnet' }, { k: 'model', to: 'fable' }])), true);
  assert.equal(hasQuietPair(s([{ k: 'model', to: 'sonnet' }, { k: 'turn' }, { k: 'compact' }])), false);
});

test('stub: answers each directive from the request alone', () => {
  const user = (text: string): Record<string, unknown> => ({ tools: TOOLS, messages: [{ role: 'user', content: text }] });
  assert.deepEqual(reply(user('DB 3 turn'), '/p').content, [{ type: 'text', text: 'ok' }]);
  const spawn = reply(user('DB 4 spawn Explore.- general-purpose.haiku'), '/p');
  assert.equal(spawn.stop, 'tool_use');
  assert.deepEqual(
    spawn.content.map((b) => [b.name, (b.input as Record<string, unknown>).subagent_type, (b.input as Record<string, unknown>).model]),
    [
      ['Agent', 'Explore', undefined],
      ['Agent', 'general-purpose', 'haiku'],
    ],
  );
  const read = reply(user('DB 5 edit code'), '/p');
  assert.deepEqual([read.content[0]?.name, (read.content[0]?.input as Record<string, unknown>).file_path], ['Read', '/p/src/app.ts']);
  const edit = reply({ tools: TOOLS, messages: [{ role: 'user', content: 'DB 5 edit code' }, { role: 'assistant', content: read.content }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'file' }] }] }, '/p');
  assert.equal(edit.content[0]?.name, 'Edit');
  assert.equal(reply(user('DB 6 edit new'), '/p').content[0]?.name, 'Write');
  assert.deepEqual(reply(user('DB-SUB 4 0 Explore: reply with the word done.'), '/p').content, [{ type: 'text', text: 'done' }]);
  assert.match(String(reply(user('Summarize. Respond with TEXT ONLY.'), '/p').content[0]?.text), /<summary>/);
});

test('oracle: kinds of request', () => {
  assert.equal(kindOf(body('claude-haiku-5-5', '')), 'main');
  assert.equal(kindOf({ ...body('claude-haiku-5-5', '', 'DB-SUB 1 0 Plan: reply'), tools: TOOLS }), 'subagent');
  assert.equal(kindOf({ messages: [{ role: 'user', content: 'Respond with TEXT ONLY' }] }), 'compact');
  assert.equal(kindOf({ messages: [{ role: 'user', content: 'title this' }] }), 'other');
});

test('oracle: the three parts of the invariant', () => {
  const opus = rulesOf('claude-opus-5-5');
  const haiku = rulesOf('claude-haiku-5-5');
  const covered = inspect(ref, body('claude-opus-5-5', opus.join('\n\n')), where);
  assert.equal(covered.covered, true);
  assert.deepEqual(covered.violations, []);
  assert.equal(covered.chars.ownFirst, opus.reduce((n, t) => n + t.length, 0));

  const missing = inspect(ref, body('claude-opus-5-5', 'nothing here'), where);
  assert.equal(missing.covered, false);
  assert.deepEqual(
    missing.violations.map((v) => v.class),
    ['missing-own'],
  );

  // Haiku's rules in an Opus request: retired by a later note from Haiku, foreign without one.
  const note = switchNote('claude-haiku-5-5', 'claude-opus-5-5');
  const retired = inspect(ref, body('claude-opus-5-5', [...haiku, note, ...opus].join('\n\n')), where);
  assert.deepEqual(retired.violations, []);
  assert.ok(retired.chars.foreignRetired > 0);
  assert.ok(retired.chars.overhead >= note.length);
  assert.deepEqual(retired.notes, ['claude-haiku-5-5>claude-opus-5-5']);
  const foreign = inspect(ref, body('claude-opus-5-5', [...opus, ...haiku].join('\n\n')), where);
  assert.deepEqual(
    foreign.violations.map((v) => v.class),
    ['foreign-unretired'],
  );
  assert.ok(foreign.chars.foreignUnretired > 0);

  // A note that retires the request's own model after its rules.
  const ownRetired = inspect(ref, body('claude-opus-5-5', [...opus, switchNote('claude-opus-5-5', 'claude-haiku-5-5')].join('\n\n')), where);
  assert.equal(ownRetired.covered, false);
  assert.deepEqual(
    ownRetired.violations.map((v) => v.class),
    ['own-retired'],
  );

  // A note can retire several models at once, or every model but the new one.
  const sonnet = rulesOf('claude-sonnet-5-5');
  const several = switchNote('claude-sonnet-5-5', 'claude-opus-5-5', ['claude-sonnet-5-5', 'claude-haiku-5-5']);
  assert.match(several, /from="claude-sonnet-5-5 claude-haiku-5-5"/);
  assert.deepEqual(inspect(ref, body('claude-opus-5-5', [...haiku, ...sonnet, several, ...opus].join('\n\n')), where).violations, []);
  const every = several.replace(/from="[^"]*"/, 'from="*"');
  assert.deepEqual(inspect(ref, body('claude-opus-5-5', [...haiku, ...sonnet, every, ...opus].join('\n\n')), where).violations, []);
  assert.deepEqual(
    inspect(ref, body('claude-opus-5-5', [...opus, every.replace('to="claude-opus-5-5"', 'to="claude-haiku-5-5"')].join('\n\n')), where).violations.map((v) => v.class),
    ['own-retired'],
  );

  // A repeated rule is counted once as the right rule and once as a duplicate.
  const twice = inspect(ref, body('claude-opus-5-5', [...opus, ...opus].join('\n\n')), where);
  assert.equal(twice.chars.ownDuplicate, twice.chars.ownFirst);
});

test('oracle: the reference gives every model the preset under `on` and none under the native arms', () => {
  assert.deepEqual(
    Object.values((configFor('on') as { models: Record<string, { use: string }> }).models).map((m) => m.use),
    MODELS.map(() => 'preset'),
  );
  assert.deepEqual(
    Object.values((configFor('claudemd') as { models: Record<string, { use: string }> }).models).map((m) => m.use),
    MODELS.map(() => 'none'),
  );
});

function fact(over: Partial<RequestFact> & Pick<RequestFact, 'kind' | 'step'>): RequestFact {
  const chars = { ownFirst: 0, ownDuplicate: 0, ownUnexpected: 0, foreignRetired: 0, foreignUnretired: 0, overhead: 0, rule: 0, request: 1000 };
  return { i: 0, at: '2026-11-19T00:00:00.000Z', model: 'claude-opus-5-5', session: 's1', expected: [], covered: null, expectedPresent: 0, chars, notes: [], violations: [], ...over };
}

function line(spec: Run, facts: RequestFact[], harness = 'ok'): Line {
  const r = { id: spec.id, spec, harness, claudeCode: '2.1.328', ms: 1000, steps: [], facts, decisions: [] };
  return { ...r, violations: violationsOf(r) };
}

test('fuzz: violations, the documented exception, and what counts as a failure', () => {
  const spec: Run = { id: 'on-s1-0001', arm: 'on', plant: null, model: 'sonnet', scope: null, unattended: true, steps: [{ k: 'spawn', calls: [{ type: 'Plan', model: 'haiku' }, { type: 'Plan', model: null }] }, { k: 'turn' }] };
  assert.equal(knownReason(spec, { kind: 'subagent', step: 0 }, 'missing-own'), 'shared-start-calls-differ');
  assert.equal(knownReason(spec, { kind: 'subagent', step: 0 }, 'foreign-unretired'), null);
  assert.equal(knownReason(spec, { kind: 'main', step: 0 }, 'missing-own'), null);
  const known = line(spec, [fact({ kind: 'subagent', step: 0, violations: [{ class: 'missing-own', rules: ['x'] }] })]);
  assert.equal(failed(known), false);
  const bad = line(spec, [fact({ kind: 'main', step: 1, violations: [{ class: 'foreign-unretired', rules: ['x'] }] })]);
  assert.equal(failed(bad), true);
  assert.deepEqual(signature(bad), ['foreign-unretired/main']);
  assert.equal(failed(line(spec, bad.facts as RequestFact[], 'step-timeout:1')), false, 'a session the driver could not run is not measured');
  assert.deepEqual(
    fuzzRuns(1, 2, 'claudemd').map((r) => r.id),
    ['claudemd-s1-0000', 'claudemd-s1-0001'],
  );
  assert.equal(fuzzRuns(1, 1, 'on', 'no-switch-note')[0]?.id, 'plant-no-switch-note-s1-0000');
  assert.equal(sessionKey('plant-no-switch-note-s1-0014'), 's1-0014');
});

test('shrink: delta debugging finds the shortest sequence that still fails, then simplifies it', async () => {
  // A stand-in for a real session: it fails when two /model switches follow each other.
  const fails = async (s: Sequence): Promise<boolean> => {
    assert.deepEqual(Object.keys(s).sort(), ['model', 'scope', 'steps', 'unattended'], 'a candidate carries only the sequence, never the session id it came from');
    return s.steps.some((x, i) => x.k === 'model' && s.steps[i + 1]?.k === 'model');
  };
  const base: Sequence = {
    model: 'haiku',
    scope: 'build',
    unattended: true,
    steps: [{ k: 'edit', target: 'code' }, { k: 'clear' }, { k: 'turn' }, { k: 'model', to: 'sonnet' }, { k: 'model', to: 'fable' }, { k: 'spawn', calls: [{ type: 'Plan', model: 'opus' }] }, { k: 'turn' }],
  };
  const r = await shrink({ ...base, id: 'on-s1-0170' } as Sequence, { class: 'foreign-unretired', kind: 'main' }, fails, 3);
  assert.deepEqual(r.spec, {
    model: 'haiku',
    scope: null,
    unattended: true,
    steps: [
      { k: 'model', to: 'sonnet' },
      { k: 'model', to: 'fable' },
    ],
  });
  assert.equal(r.originalSteps, 7);
  assert.equal(r.minimalSteps, 2);
  await assert.rejects(shrink({ ...base, steps: [{ k: 'turn' }] }, { class: 'missing-own', kind: 'main' }, fails), /does not reproduce/);
});

test('measure: coverage, precision, cost and robustness of a set of sessions', () => {
  const spec: Run = { id: 'on-s1-0002', arm: 'on', plant: null, model: 'haiku', scope: null, unattended: true, steps: [{ k: 'turn' }, { k: 'model', to: 'sonnet' }, { k: 'model', to: 'fable' }, { k: 'turn' }] };
  const chars = (own: number, foreign: number, overhead: number) => ({ ownFirst: own, ownDuplicate: 0, ownUnexpected: 0, foreignRetired: 0, foreignUnretired: foreign, overhead, rule: own + foreign, request: 10000 });
  const l = line(spec, [
    fact({ kind: 'main', step: 0, covered: true, expected: ['a'], expectedPresent: 1, chars: chars(300, 0, 100) }),
    fact({ kind: 'main', step: 3, covered: true, expected: ['b'], expectedPresent: 1, chars: chars(300, 100, 200), violations: [{ class: 'foreign-unretired', rules: ['a'] }] }),
    fact({ kind: 'compact', step: 3 }),
  ]);
  const m = measure([l, line({ ...spec, id: 'on-s1-0003' }, [], 'startup-timeout')]);
  assert.equal(m.sessions, 2);
  assert.deepEqual(m.harness, { ok: 1, 'startup-timeout': 1 });
  assert.equal(m.requests, 3);
  assert.deepEqual([m.coverage.due, m.coverage.covered, m.coverage.coverage], [2, 2, 1]);
  assert.equal(m.precision.ownShare, 0.8571);
  assert.equal(m.precision.rightShare, 0.6);
  assert.equal(m.cost.addedCharsPerAgentRequest, 500);
  assert.equal(m.robustness.requestsWithViolation['foreign-unretired'], 1);
  assert.equal(m.robustness.sessionsFailed, 1);
  assert.deepEqual(Object.keys(m.robustness.byQuietPair), ['two quiet steps in a row']);
  assert.deepEqual(Object.keys(m.byPath), ['after /model', 'start']);
  assert.equal(pathOf(spec, { kind: 'subagent', step: 3 }), 'subagent');
  assert.match(renderMarkdown({ 'on-s1-n2': m }), /\| Coverage \| 100\.0% \(2 of 2\) \|/);
});

test('compare: paired sessions, Holm over the primary comparisons, and the verdict of each kind', () => {
  const run = (arm: Run['arm'], i: number): Run => ({ id: `${arm}-s1-${String(i).padStart(4, '0')}`, arm, plant: null, model: 'haiku', scope: null, unattended: true, steps: [{ k: 'turn' }] });
  const ok = fact({ kind: 'main', step: 0, covered: true, expected: ['a'], expectedPresent: 1 });
  const bad = fact({ kind: 'main', step: 0, covered: false, expected: ['a'], violations: [{ class: 'missing-own', rules: ['a'] }] });
  const badSub = fact({ kind: 'subagent', step: 0, covered: false, expected: ['a'], violations: [{ class: 'missing-own', rules: ['a'] }] });
  // Before: sessions 0 to 11 fail; after: only session 0 does, and session 12 did not run.
  const before = Array.from({ length: 20 }, (_, i) => line(run('on', i), [i < 12 ? bad : ok]));
  const after = Array.from({ length: 20 }, (_, i) => line(run('on', i), [i === 0 ? bad : ok], i === 12 ? 'step-timeout:0' : 'ok'));
  const native = Array.from({ length: 10 }, (_, i) => line(run('claudemd', i), [ok, badSub]));
  assert.deepEqual(pair(before, after, 'failed'), { sessions: 19, both: 1, onlyA: 11, onlyB: 0, onlyAExamples: ['s1-0001', 's1-0002', 's1-0003', 's1-0004', 's1-0005'], onlyBExamples: [] });
  assert.equal(pair(native, after, 'uncovered-subagent').onlyA, 10);
  assert.equal(pair(native, after, 'uncovered').both, 1, 'a session lacking a rule in its own conversation is uncovered too');

  const folder = (runs: Record<string, Line[]>, agree: Record<string, unknown> | null = null): Folder => ({ sessions: (r) => runs[r] ?? null, file: (n) => (n === 'agree' ? agree : null) });
  const design: Design = {
    description: 'test',
    claudeCode: '2.1.328',
    command: 'all',
    before: 'x',
    alpha: 0.05,
    comparisons: [
      { id: 'P1', primary: true, question: 'fewer failures', a: { folder: 'before', run: 'on' }, b: { folder: 'after', run: 'on' }, measure: 'robustness.sessionsFailed', expect: 'lower', paired: 'failed' },
      { id: 'P2', primary: true, question: 'more failures', a: { folder: 'after', run: 'on' }, b: { folder: 'before', run: 'on' }, measure: 'robustness.sessionsFailed', expect: 'lower', paired: 'failed' },
      { id: 'P3', primary: true, question: 'first ten', a: { folder: 'after', run: 'claudemd' }, b: { folder: 'after', run: 'on', first: 10 }, measure: 'coverage.subagents.coverage', expect: 'higher', paired: 'uncovered-subagent' },
      { id: 'C1', question: 'unchanged', a: { folder: 'after', run: 'claudemd' }, b: { folder: 'after', run: 'claudemd' }, measure: 'coverage.coverage', expect: 'same', paired: 'uncovered' },
      { id: 'S1', question: 'log', a: { folder: 'after', run: 'on', file: 'agree', measure: 'coverage.log' }, b: { folder: 'after', run: 'on', file: 'agree', measure: 'coverage.stub' }, expect: 'same' },
      { id: 'R1', question: 'cost', a: { folder: 'before', run: 'on' }, b: { folder: 'after', run: 'on' }, measure: 'cost.addedCharsPerAgentRequest', expect: null },
      { id: 'N1', question: 'missing', a: { folder: 'before', run: 'rules' }, b: { folder: 'after', run: 'on' }, measure: 'coverage.coverage', expect: 'higher' },
    ],
  };
  const rows = evaluate(design, { before: folder({ on: before }), after: folder({ on: after, claudemd: native }, { on: { coverage: { log: 1, stub: 0.99 } } }) });
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.deepEqual([byId.P1?.a, byId.P1?.b, byId.P1?.verdict], [12, 1, 'supported']);
  assert.equal(byId.P2?.verdict, 'against');
  assert.equal(byId.P1?.adjustedP, 3 * (byId.P1?.p as number), 'Holm multiplies the smallest of three p values by three');
  assert.deepEqual([byId.P3?.a, byId.P3?.b, byId.P3?.pairs?.sessions, byId.P3?.verdict], [0, null, 10, 'not measured'], 'the first ten `on` sessions have no subagent request');
  assert.equal(byId.C1?.verdict, 'holds');
  assert.deepEqual([byId.S1?.a, byId.S1?.b, byId.S1?.verdict], [1, 0.99, 'does not hold']);
  assert.equal(byId.R1?.verdict, 'reported');
  assert.equal(byId.N1?.verdict, 'not measured');
  assert.equal(byId.C1?.adjustedP, null, 'only primary comparisons are adjusted');
  const md = renderComparison('test', design, rows);
  assert.match(md, /\| P1 \(primary\) \| fewer failures \| `robustness\.sessionsFailed` \| lower \| 12 \| 1 \| 19: 1, 11, 0 \|/);
  assert.match(md, /\| S1 \| log \| `coverage\.log against coverage\.stub` \| same \| 100\.0% \| 99\.0% \|/);

  const planned = readDesign(path.join(PACKAGE_ROOT, 'experiments', 'delivery', 'plan.json'), 'after-f1-f2');
  assert.ok(planned.comparisons.every((c) => c.measure || (c.a.measure && c.b.measure)), 'every planned comparison names its measure');
  assert.throws(() => readDesign(path.join(PACKAGE_ROOT, 'experiments', 'delivery', 'plan.json'), 'nope'), /no design nope/);
});

test('log replay: what the conversation holds after each decision', () => {
  const lib = ruleLibrary();
  const opus = resolve(ref.config, { model: 'claude-opus-5-5', scope: null, place: 'unattended' });
  const haiku = resolve(ref.config, { model: 'claude-haiku-5-5', scope: null, place: 'unattended' });
  assert.ok(opus.status === 'matched' && haiku.status === 'matched');
  const start = { ts: '2026-11-19T00:00:01Z', session_id: 's', event: 'session-start', source: 'startup', model: 'claude-opus-5-5', status: 'matched', delivered: 'rules', rules: opus.rules };
  const sw = { ts: '2026-11-19T00:00:02Z', session_id: 's', event: 'model-switch', model: 'claude-haiku-5-5', from_model: 'claude-opus-5-5', status: 'matched', delivered: 'rules+note', rules: haiku.rules };
  const lost = { ...sw, ts: '2026-11-19T00:00:03Z', delivered: 'rules', from_model: undefined };
  const good = replay([start, sw], lib);
  assert.deepEqual(
    good.points.map((p) => [p.event, p.due, p.covered, p.foreignUnretired]),
    [
      ['session-start', true, true, false],
      ['model-switch', true, true, false],
    ],
  );
  assert.ok((good.points[1]?.chars.foreignRetired ?? 0) > 0);
  assert.equal(replay([start, lost], lib).points[1]?.foreignUnretired, true);
  // Two switches: the second note retires Opus too, though the log names only Haiku in from_model.
  const back = { ...sw, ts: '2026-11-19T00:00:03Z', model: 'claude-sonnet-5-5', from_model: 'claude-haiku-5-5', rules: [] as string[], status: 'none', delivered: 'note' };
  assert.equal(replay([start, sw, back], lib).points[2]?.foreignUnretired, false);
  const clear = { ...start, ts: '2026-11-19T00:00:04Z', source: 'clear' };
  assert.equal(replay([start, sw, clear], lib).points[2]?.chars.foreignRetired, 0, '/clear empties the conversation');
  const a = aggregate(good);
  assert.deepEqual([a.sessions, a.coverage.points.due, a.coverage.points.covered], [1, 2, 2]);
  assert.ok((a.cost.charsPerDelivery ?? 0) > 0);
});

test('log replay agrees with the stub when the log and the requests say the same thing', () => {
  const opus = resolve(ref.config, { model: 'claude-opus-5-5', scope: null, place: 'unattended' });
  assert.ok(opus.status === 'matched');
  const own = opus.rules.reduce((n, id) => n + (ref.byId.get(id)?.text.length ?? 0), 0);
  const spec: Run = { id: 'on-s1-0004', arm: 'on', plant: null, model: 'opus', scope: null, unattended: true, steps: [{ k: 'turn' }] };
  const l = {
    ...line(spec, [fact({ kind: 'main', step: 0, at: '2026-11-19T00:00:02Z', covered: true, expected: [...opus.rules], expectedPresent: opus.rules.length, chars: { ownFirst: own, ownDuplicate: 0, ownUnexpected: 0, foreignRetired: 0, foreignUnretired: 0, overhead: 0, rule: own, request: 1 } })]),
    decisions: [{ ts: '2026-11-19T00:00:01Z', session_id: 's1', event: 'session-start', source: 'startup', model: 'claude-opus-5-5', status: 'matched', delivered: 'rules', rules: opus.rules }],
  };
  const r = agree([l], ruleLibrary(), (x) => hasQuietPair(x.spec));
  assert.deepEqual([r.mainRequests, r.all, r.sessionsWhereTheyDiffer], [1, 1, 0]);
});

test('plants: each planted line is in the built hook exactly once', () => {
  assert.ok(PLANTS.length >= 2);
  for (const p of PLANTS) {
    assert.equal(occurrences(p), 1, `${p.name}: ${p.find}`);
    assert.notEqual(p.find, p.replace);
  }
});

test('plants: a session is caught when the planted build fails where the real one did not', () => {
  const plant = PLANTS[0] as (typeof PLANTS)[number];
  const spec = (id: string): Run => ({ id, arm: 'on', plant: null, model: 'haiku', scope: null, unattended: true, steps: [{ k: 'model', to: 'sonnet' }, { k: 'turn' }] });
  const bad = (id: string): Line => line(spec(id), [fact({ kind: 'main', step: 1, violations: [{ class: 'foreign-unretired', rules: ['x'] }] })]);
  const good = (id: string): Line => line(spec(id), [fact({ kind: 'main', step: 1 })]);
  const c = comparePlant(plant, [good('on-s1-0000'), bad('on-s1-0001'), good('on-s1-0002')], [bad('plant-x-s1-0000'), bad('plant-x-s1-0001'), good('plant-x-s1-0002')]);
  assert.deepEqual(c.failedOnlyOnPlanted, ['plant-x-s1-0000']);
  assert.deepEqual([c.sessions, c.failedOnReal, c.failedOnPlanted], [3, 1, 2]);
});

test('corpus: every entry can be driven, and expects a pass or names the violations of a known failure', () => {
  const entries = readCorpus();
  assert.ok(entries.length >= 10);
  assert.equal(new Set(entries.map((e) => e.name)).size, entries.length);
  assert.ok(entries.some((e) => e.name === 'probe-session' && e.expect === 'pass'), 'the delivery probe session is in the corpus');
  for (const prefix of ['f1-', 'f2-']) assert.ok(entries.some((e) => e.name.startsWith(prefix) && e.expect === 'pass'), `the corpus keeps the ${prefix} sequences, which must pass since their fix`);
  for (const e of entries) if (e.expect !== 'pass') for (const s of e.expect.shows) assert.match(s, /^(missing-own|own-retired|foreign-unretired)\/(main|subagent)$/, e.name);
});

test('corpus: the outcome of an entry', () => {
  const entry = (expect: Entry['expect']): Entry => ({ name: 'x', about: '', model: 'haiku', scope: null, unattended: true, steps: [{ k: 'turn' }], expect });
  const spec: Run = { id: 'corpus-x', arm: 'on', plant: null, model: 'haiku', scope: null, unattended: true, steps: [{ k: 'turn' }] };
  const clean = line(spec, [fact({ kind: 'main', step: 0, covered: true })]);
  const broken = line(spec, [fact({ kind: 'main', step: 0, covered: true, violations: [{ class: 'foreign-unretired', rules: ['x'] }] })]);
  const nothing = line(spec, [fact({ kind: 'main', step: 0 })]);
  const f1 = { failure: 'F1', shows: ['foreign-unretired/main'] };
  assert.equal(check(entry('pass'), clean).outcome, 'as-expected');
  assert.equal(check(entry('pass'), broken).outcome, 'regressed');
  assert.equal(check(entry('pass'), nothing).outcome, 'nothing-due');
  assert.equal(check(entry(f1), broken).outcome, 'as-expected');
  assert.equal(check(entry(f1), clean).outcome, 'fixed');
  assert.equal(check(entry({ failure: 'F1', shows: ['missing-own/main'] }), broken).outcome, 'changed');
  assert.equal(check(entry('pass'), line(spec, [], 'startup-timeout')).outcome, 'harness');
});

test('oracle facts carry no request text', () => {
  const f: Fact = inspect(ref, body('claude-opus-5-5', rulesOf('claude-opus-5-5').join('\n')), where);
  assert.ok(!JSON.stringify(f).includes(rulesOf('claude-opus-5-5')[0]?.slice(0, 40) ?? '\u0000'));
});
