// The adoption evaluation's fixed parts, without Claude Code: the prompt stays neutral, the scoring
// gives every calibration answer its expected result, verdicts and judgments parse, the reference
// lists the commands the CLI has, the allocation follows the rule its README fixes, and a copy of the
// repository leaves the experiment out.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  allocate,
  asJudgment,
  calibration,
  DIR,
  type JudgeRecord,
  lastJson,
  parseVerdict,
  plan,
  prepareTree,
  PROMPT,
  type RunRecord,
  score,
  summarize,
} from '../experiments/adoption/run.js';
import { runCli } from './helpers.js';

test('adoption: the prompt says nothing of the README, an evaluation or the outcome hoped for', () => {
  const prompt = PROMPT().toLowerCase();
  for (const word of ['readme', 'evaluat', 'score', 'judge', 'hope', 'expect', 'noonsight', 'evidence', 'benchmark', 'should adopt', 'recommend adopting'])
    assert.ok(!prompt.includes(word), `the prompt says "${word}"`);
  for (const field of ['Verdict:', 'Reasons:', 'Conditions and risks:', 'What it guarantees:']) assert.ok(PROMPT().includes(field), `the prompt asks for ${field}`);
});

test('adoption: each calibration answer parses to its verdict and scores to its expected grounding', () => {
  const answers = calibration();
  assert.ok(answers.length >= 6);
  assert.ok(answers.some((a) => a.expected.grounded) && answers.some((a) => !a.expected.grounded), 'the calibration holds both outcomes');
  assert.ok(answers.some((a) => a.expected.grounded && a.expected.verdict === 'do not adopt'), 'a grounded refusal is a pass');
  for (const a of answers) {
    assert.equal(parseVerdict(a.text), a.expected.verdict, a.id);
    const judgment = asJudgment({ ...a.expected, reasons: a.expected.reasons.map((s) => ({ reason: 'r', status: s })) });
    assert.ok(judgment, a.id);
    assert.equal(score(judgment).grounded, a.expected.grounded, a.id);
    assert.equal(score(judgment).adopt_on_wrong_grounds, a.expected.verdict !== 'do not adopt' && !a.expected.grounded, a.id);
  }
});

test('adoption: verdict lines and the last JSON value of a reply', () => {
  assert.equal(parseVerdict('**Verdict:** Do not adopt (yet)'), 'do not adopt');
  assert.equal(parseVerdict('Verdict: Adopt with conditions.'), 'adopt with conditions');
  assert.equal(parseVerdict('## Verdict\n\nAdopt'), 'adopt');
  assert.equal(parseVerdict('Reasons: it may be worth it to adopt'), 'none');
  assert.equal(parseVerdict('Verdict: adopt'), 'adopt');
  assert.deepEqual(lastJson('draft {"a": 1} then {"b": {"c": 2}} done'), { b: { c: 2 } });
  assert.equal(lastJson('no json here'), undefined);
  assert.equal(asJudgment({ verdict: 'maybe', delivery_claim: 'correct', reasons: [], limits_named: [], hallucinated_features: [], false_claims: [] }), null);
});

test('adoption: the reference lists exactly the commands the CLI has', () => {
  const help = runCli(['--help']).stdout.split('Commands:')[1]?.split('Options:')[0] ?? '';
  const commands = [...help.matchAll(/^ {2}([a-z]+)\b/gm)].map((m) => m[1] as string).sort();
  const rubric = fs.readFileSync(path.join(DIR, 'rubric.md'), 'utf8');
  const line = rubric.split('\n').find((l) => l.startsWith('- Commands:')) ?? '';
  const listed = [...line.matchAll(/`(?:noonsight )?([a-z]+)`/g)].map((m) => m[1] as string).sort();
  assert.deepEqual(listed, commands);
});

test('adoption: the plan runs the preset\'s four models, and the pass bar is the README\'s', () => {
  const p = plan();
  assert.deepEqual(Object.values(p.models).sort(), ['claude-fable-5-2', 'claude-haiku-5-5', 'claude-opus-5-5', 'claude-sonnet-5-5']);
  assert.deepEqual(p.conditions, ['before', 'after']);
  assert.ok(p.cap_usd <= 20 && p.concurrency <= 2);
  const readme = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8');
  assert.ok(readme.includes(`at least ${p.pass.grounded_after * 100}% are grounded`));
  assert.ok(readme.includes(`at least ${p.pass.grounded_after_per_model * 100}% are grounded`));
  assert.ok(readme.includes(`cap of $${p.cap_usd}`));
});

test('adoption: the allocation takes the most sessions that fit, and leaves Fable out first', () => {
  const p = plan();
  const pilot = (costs: Record<string, number>): { model: string; cost_usd: number }[] => Object.entries(costs).flatMap(([model, c]) => [{ model, cost_usd: c }, { model, cost_usd: c }]);
  assert.deepEqual(allocate(p, pilot({ fable: 0.3, opus: 0.2, sonnet: 0.1, haiku: 0.02 }), 0.05, 0.3)?.reps, p.reps.max);
  const tight = allocate(p, pilot({ fable: 2.5, opus: 0.6, sonnet: 0.3, haiku: 0.05 }), 0.05, 0.3);
  assert.ok(tight && !tight.models.includes('fable') && tight.projected <= p.cap_usd, JSON.stringify(tight));
  assert.equal(allocate(p, pilot({ fable: 9, opus: 9, sonnet: 9, haiku: 9 }), 0.05, 0.3), null);
});

test('adoption: the summary reads the pass bar from the scored answers', () => {
  const p = plan();
  const run = (condition: string, model: string, rep: number): RunRecord =>
    ({ condition, model, rep, api: 'stub', ref: 'x', commit: `${condition}0000000`, tree: 't', model_id: 'm', effort: 'medium', claude_code: '0', started: '', outcome: 'answered', cost_usd: 0.1, turns: 1, duration_ms: 1, tool_calls: {}, files_read: [], verdict: 'adopt', answer: '' }) as RunRecord;
  const judged = (key: string, grounded: boolean): JudgeRecord => ({
    key,
    api: 'stub',
    judge: 'j',
    cost_usd: 0.01,
    attempts: 1,
    judgment: null,
    score: { verdict: 'adopt', claim_correct: grounded, no_false_reason: true, no_hallucination: true, names_a_limit: true, grounded, adopt_on_wrong_grounds: !grounded },
  });
  const runs = ['after', 'before'].flatMap((c) => ['sonnet', 'haiku'].flatMap((m) => [1, 2].map((r) => run(c, m, r))));
  const judgments = runs.map((r) => judged(`${r.condition}-${r.model}-${r.rep}`, r.condition === 'after'));
  const text = summarize(p, runs, judgments);
  assert.match(text, /\*\*The README passes: yes\.\*\*/);
  assert.match(summarize(p, runs, judgments.map((j) => (j.key === 'after-haiku-1' || j.key === 'after-haiku-2' ? judged(j.key, false) : j))), /\*\*The README passes: no\.\*\*/);
});

test('adoption: a session\'s copy of the repository leaves the experiment out', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-adoption-tree-'));
  try {
    const { commit } = prepareTree('HEAD', path.join(dest, 'repo'), plan().exclude);
    assert.match(commit, /^[0-9a-f]{40}$/);
    assert.ok(fs.existsSync(path.join(dest, 'repo', 'README.md')));
    assert.ok(!fs.existsSync(path.join(dest, 'repo', 'experiments', 'adoption')));
    assert.ok(!fs.existsSync(path.join(dest, 'repo', '.git')));
  } finally {
    fs.rmSync(dest, { recursive: true, force: true });
  }
});
