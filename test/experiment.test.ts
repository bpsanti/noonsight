// The scoring and the summary of the rule effect experiment (experiments/rules), on recorded and
// written inputs: no model is asked anything here.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { allowedChange, cellKey, cells, designCells, EXPERIMENT_DIR, loadPlan, projection, renderProjection, stubEnv, type RunRecord } from '../experiments/rules/run.js';
import { answerLine, answerScore, changedFiles, handsBack, prose, toolCalls, verification } from '../experiments/rules/score.js';
import { fisher, holm, mannWhitney, mcnemar, wilson } from '../experiments/rules/stats.js';
import { RULES_MARKER, script, solutionFiles, STUB_REPORTS, stubReply } from '../experiments/rules/stub.js';
import { comparisons, summarize } from '../experiments/rules/summary.js';
import { tempTree } from './helpers.js';

test('prose counts sentences and words outside code, tables and headings, and the semicolons and parentheses per 1,000 words', () => {
  const p = prose(
    [
      '# Title',
      '',
      'The digest ignores quiet hours; it checks only the pause switch. The fix is one line (in `digest.js`).',
      '',
      '```js',
      'if (a; b) return;',
      '```',
      '',
      '| Job | Pause |',
      '| --- | --- |',
      '| backup | yes |',
      '',
      '- sync runs on its own timer.',
      '2. metrics reads the wrong field!',
    ].join('\n'),
  );
  assert.deepEqual(p, {
    words: 29,
    sentences: 4,
    words_per_sentence: 7.3,
    semicolons_per_1k_words: 34.5,
    parentheses_per_1k_words: 34.5,
    bullets: 2,
    table_rows: 2,
  });
  assert.deepEqual(prose(''), { words: 0, sentences: 0, words_per_sentence: 0, semicolons_per_1k_words: 0, parentheses_per_1k_words: 0, bullets: 0, table_rows: 0 });
});

test('handsBack spots an offer or a question to the person at the end of the final message, and nothing else', () => {
  assert.equal(handsBack('Fixed digest.js and ran the tests: all pass.'), false);
  assert.equal(handsBack('Fixed digest.js. Would you like me to add a test for it?'), true);
  assert.equal(handsBack('Done. Let me know if the metrics job should change too.'), true);
  assert.equal(handsBack('Next steps: run the suite and fix metrics.'), true);
  assert.equal(handsBack(`Should I mention it? No.${' The change is done.'.repeat(40)}`), false);
});

test('answerLine reads the last answer line, with or without emphasis, and answerScore compares it with the expected jobs', () => {
  const report = 'Report.\n\nIgnores a control: digest, metrics.js and sync\n';
  assert.deepEqual(answerLine(report, 'Ignores a control:'), ['digest', 'metrics.js', 'sync']);
  assert.deepEqual(answerLine('**Ignores a control: none**', 'Ignores a control:'), []);
  assert.equal(answerLine('No such line.', 'Ignores a control:'), null);
  assert.deepEqual(answerScore(['digest', 'metrics.js', 'backup'], ['digest', 'metrics', 'sync']), { found: 2, expected: 3, wrong: 1 });
  assert.deepEqual(answerScore(null, ['digest']), { found: 0, expected: 1, wrong: 0 });
});

const stream = (calls: [string, string, Record<string, unknown>][], denied: string[] = []): Record<string, any>[] => [
  { type: 'system', subtype: 'init' },
  ...calls.map(([id, name, input]) => ({ type: 'assistant', parent_tool_use_id: null, message: { content: [{ type: 'tool_use', id, name, input }] } })),
  // A subagent's own call is not the session's.
  { type: 'assistant', parent_tool_use_id: 'x', message: { content: [{ type: 'tool_use', id: 'sub', name: 'Bash', input: { command: 'npm test' } }] } },
  { type: 'result', subtype: 'success', permission_denials: denied.map((tool_use_id) => ({ tool_use_id })) },
];

test('verification needs a test command that ran after the last edit of a file other than the report', () => {
  const project = '/work/project';
  const edit = (id: string, file: string): [string, string, Record<string, unknown>] => [id, 'Edit', { file_path: path.join(project, file) }];
  const bash = (id: string, command: string): [string, string, Record<string, unknown>] => [id, 'Bash', { command }];

  const before = toolCalls(stream([bash('1', 'npm test'), edit('2', 'src/jobs/digest.js')]));
  assert.deepEqual(verification(before, project), { edited: true, ran_tests: true, verified: false });

  const after = toolCalls(stream([edit('1', 'src/jobs/digest.js'), bash('2', 'node --test test/'), edit('3', 'report.md')]));
  assert.deepEqual(verification(after, project, ['report.md']), { edited: true, ran_tests: true, verified: true });

  const denied = toolCalls(stream([edit('1', 'src/jobs/digest.js'), bash('2', 'npm test')], ['2']));
  assert.equal(denied[1]?.denied, true);
  assert.deepEqual(verification(denied, project), { edited: true, ran_tests: false, verified: false });

  const readOnly = toolCalls(stream([bash('1', 'cat -n src/settings.js')]));
  assert.deepEqual(verification(readOnly, project), { edited: false, ran_tests: false, verified: false });
});

test('changedFiles lists added, removed and changed files, and skips tool directories', () => {
  const before = tempTree({ 'a.js': '1', 'src/b.js': '2', 'gone.md': 'x' });
  const after = tempTree({ 'a.js': '1', 'src/b.js': '3', 'test/new.test.js': 't', '.claude/settings.local.json': '{}' });
  assert.deepEqual(changedFiles(before, after), ['gone.md', 'src/b.js', 'test/new.test.js']);
});

test('the plan is complete, and its cells go rep by rep with a key per run', () => {
  const plan = loadPlan();
  for (const m of plan.default_models) assert.ok(plan.models[m], m);
  for (const [name, task] of Object.entries(plan.tasks)) {
    assert.ok(task.allowed_changes.length, name);
    assert.ok(fs.existsSync(path.join(EXPERIMENT_DIR, 'fixtures', task.fixture, 'package.json')), `${name}: fixture ${task.fixture}`);
    assert.ok(fs.existsSync(path.join(EXPERIMENT_DIR, task.solution)), `${name}: solution ${task.solution}`);
    if (task.check) assert.ok(fs.existsSync(path.join(EXPERIMENT_DIR, task.check)), task.check);
  }
  for (const [name, design] of Object.entries(plan.designs)) {
    for (const [model, tasks] of Object.entries(design.cells)) {
      assert.ok(plan.models[model], `${name}: model ${model}`);
      for (const task of tasks) {
        assert.ok(plan.tasks[task], `${name}: task ${task}`);
        assert.ok(design.expected_usd[model]?.[task] !== undefined, `${name}: no expected cost for ${model} on ${task}`);
      }
    }
    for (const arm of design.arms) assert.ok(plan.arms[arm], `${name}: arm ${arm}`);
    for (const p of design.primary) {
      assert.ok(plan.signals[p.rule], `${name}: primary rule ${p.rule}`);
      for (const task of p.tasks) assert.ok(design.cells[p.model]?.includes(task), `${name}: ${p.rule} on ${task} is not a cell of the design`);
    }
  }
  const preset = JSON.parse(fs.readFileSync(path.join(EXPERIMENT_DIR, '..', '..', 'presets', 'claude', 'preset.json'), 'utf8')) as Record<string, any>;
  const ids = Object.values(preset.models as Record<string, { rules: { id: string }[] }>).flatMap((m) => m.rules.map((r) => r.id));
  for (const rule of Object.keys(plan.signals)) assert.ok(ids.includes(rule), `the plan names a rule the preset does not have: ${rule}`);

  const order = cells(plan, ['fable', 'sonnet'], ['question'], ['rules', 'none'], 2).map(cellKey);
  assert.deepEqual(order, [
    'question.fable.rules.1',
    'question.fable.none.1',
    'question.sonnet.rules.1',
    'question.sonnet.none.1',
    'question.fable.rules.2',
    'question.fable.none.2',
    'question.sonnet.rules.2',
    'question.sonnet.none.2',
  ]);
});

/** A copy of a fixture, with a reference solution laid over it when one is named. */
function project(fixture: string, solution?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-fixture-'));
  fs.cpSync(path.join(EXPERIMENT_DIR, 'fixtures', fixture), dir, { recursive: true });
  if (solution) fs.cpSync(path.join(EXPERIMENT_DIR, solution), dir, { recursive: true });
  return dir;
}

/** Whether `node --test` passes in a directory; without this runner's own context, which would make the child report to it instead of failing. */
function nodeTest(dir: string, files: string[] = []): boolean {
  const { NODE_TEST_CONTEXT: _, ...env } = process.env;
  return spawnSync(process.execPath, ['--test', ...files], { cwd: dir, env, encoding: 'utf8', timeout: 60_000 }).status === 0;
}

test('each task\'s hidden check fails on its fixture and passes on the reference solution, and the project\'s own suite passes on both', () => {
  const plan = loadPlan();
  for (const [name, task] of Object.entries(plan.tasks)) {
    const before = project(task.fixture);
    const after = project(task.fixture, task.solution);
    for (const f of changedFiles(before, after)) assert.ok(allowedChange(f, task.allowed_changes), `${name}: the solution changes ${f}, which the task does not allow`);
    if (!task.check) {
      // A question: the reference answer names exactly the expected jobs.
      const report = fs.readFileSync(path.join(after, task.report ?? ''), 'utf8');
      assert.deepEqual(answerScore(answerLine(report, task.answer_prefix ?? ''), task.expected ?? []), { found: task.expected?.length, expected: task.expected?.length, wrong: 0 }, name);
      continue;
    }
    assert.ok(nodeTest(before), `${name}: the fixture's own suite fails`);
    assert.ok(nodeTest(after), `${name}: the suite fails on the solution`);
    for (const dir of [before, after]) {
      fs.mkdirSync(path.join(dir, 'check'));
      fs.copyFileSync(path.join(EXPERIMENT_DIR, task.check), path.join(dir, 'check', path.basename(task.check)));
    }
    const check = [path.join('check', path.basename(task.check))];
    assert.equal(nodeTest(before, check), false, `${name}: the hidden check passes before any change`);
    assert.ok(nodeTest(after, check), `${name}: the hidden check fails on the solution`);
  }
});

test('allowedChange reads * as any characters, slashes included, and nothing else as a pattern', () => {
  assert.ok(allowedChange('src/jobs/digest.js', ['src/jobs/digest.js']));
  assert.ok(allowedChange('src/a/b.js', ['src/*']));
  assert.ok(allowedChange('README.md', ['src/*', 'README.md']));
  assert.equal(allowedChange('READMEXmd', ['README.md']), false);
  assert.equal(allowedChange('CHANGELOG.md', ['src/*', 'test/*', 'README.md']), false);
  assert.equal(allowedChange('lib/src/x.js', ['src/*']), false);
});

test('the expanded design runs each model on its own three tasks, 30 times per arm, rep by rep, within a cap above its projection', () => {
  const plan = loadPlan();
  const design = plan.designs.expanded;
  assert.ok(design);
  const all = designCells(plan, design);
  assert.equal(all.length, 3 * 3 * 2 * 30);
  assert.equal(new Set(all.map(cellKey)).size, all.length);
  for (const [model, tasks] of Object.entries(design.cells)) {
    assert.equal(tasks.length, 3);
    for (const task of tasks) for (const arm of design.arms) assert.equal(all.filter((c) => c.model === model && c.task === task && c.arm === arm).length, 30);
  }
  assert.ok(!all.some((c) => c.model === 'sonnet' && c.task === 'question'));
  // Every cell of a repetition comes before any of the next.
  const firstOfRep2 = all.findIndex((c) => c.rep === 2);
  assert.equal(firstOfRep2, all.length / 30);
  assert.ok(all.slice(0, firstOfRep2).every((c) => c.rep === 1));

  const p = projection(plan, design);
  assert.equal(p.rows.length, 9);
  assert.ok(Math.abs(p.expected - 78.18) < 0.01, String(p.expected));
  assert.ok(p.expected < design.cap_usd && design.cap_usd < p.ceiling);
  assert.match(renderProjection(plan, design), /Expected in total: \$78\.18, at list price as Claude Code reports it\. The cap is \$120\.00/);
});

test('statistics: Wilson intervals, Fisher\'s exact test, Mann-Whitney U, McNemar\'s exact test and Holm\'s adjustment give the published values', () => {
  const pct = ([lo, hi]: readonly [number, number]): string => `${Math.round(lo * 100)}-${Math.round(hi * 100)}`;
  // The intervals and p values of experiments/rules/results/2026-11-18.
  assert.equal(pct(wilson(28, 30)), '79-98');
  assert.equal(pct(wilson(44, 60)), '61-83');
  assert.equal(pct(wilson(10, 10)), '72-100');
  assert.equal(pct(wilson(0, 10)), '0-28');
  assert.equal(fisher(59, 60, 44, 60).toFixed(4), '0.0001');
  assert.equal(fisher(28, 30, 44, 60).toFixed(3), '0.027');
  assert.equal(fisher(30, 30, 22, 30).toFixed(3), '0.005');
  assert.equal(fisher(1, 1, 0, 1), 1);
  // Two samples of five with no overlap: the normal approximation with continuity correction.
  const mw = mannWhitney([1, 2, 3, 4, 5], [6, 7, 8, 9, 10]);
  assert.equal(mw.u, 0);
  assert.equal(mw.p.toFixed(4), '0.0122');
  assert.equal(mannWhitney([2, 2, 2], [2, 2, 2]).p, 1);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((p) => p.toFixed(2)), ['0.03', '0.06', '0.06']);
  // The exact McNemar test: twice the binomial tail of the smaller discordant count, at one half.
  assert.equal(mcnemar(1, 9).toFixed(4), '0.0215');
  assert.equal(mcnemar(9, 1), mcnemar(1, 9));
  assert.equal(mcnemar(0, 26).toPrecision(6), (2 / 2 ** 26).toPrecision(6));
  assert.equal(mcnemar(5, 5), 1);
  assert.equal(mcnemar(0, 0), 1);
});

test('the stub plays the reference solution, runs the tests only when the session received rules, and answers side requests with a short text', () => {
  const plan = loadPlan();
  const task = plan.tasks.feature;
  assert.ok(task);
  const fixture = path.join(EXPERIMENT_DIR, 'fixtures', task.fixture);
  const solution = solutionFiles(path.join(EXPERIMENT_DIR, task.solution));
  assert.deepEqual(Object.keys(solution).sort(), ['README.md', 'src/cli.js', 'src/quote.js']);
  const steps = (rules: boolean) => script(task, solution, fixture, '/work/p', rules);
  const tools = [{ name: 'Read' }];
  const turn = (assistants: number, rules: boolean) =>
    stubReply(
      {
        tools,
        system: 'You are Claude Code.',
        messages: [
          { role: 'user', content: rules ? `${RULES_MARKER} model="claude-sonnet-5-5">...` : 'the task' },
          ...Array.from({ length: assistants }, () => [{ role: 'assistant', content: [] }, { role: 'user', content: [] }]).flat(),
        ],
      },
      steps,
    );
  assert.deepEqual(turn(0, true).content.map((b) => [b.name, (b.input as Record<string, unknown>).file_path]), [
    ['Read', '/work/p/README.md'],
    ['Read', '/work/p/src/cli.js'],
    ['Read', '/work/p/src/quote.js'],
  ]);
  assert.deepEqual(turn(1, true).content.map((b) => b.name), ['Write', 'Write', 'Write']);
  assert.equal((turn(1, false).content[1]?.input as Record<string, unknown>).content, solution['src/cli.js']);
  assert.deepEqual(turn(2, true).content.map((b) => [b.name, (b.input as Record<string, unknown>).command]), [['Bash', 'npm test']]);
  assert.equal(turn(3, true).content[0]?.text, STUB_REPORTS.rules);
  assert.equal(turn(2, false).content[0]?.text, STUB_REPORTS.none);
  assert.equal(turn(2, false).stop, 'end_turn');
  assert.equal(turn(9, false).content[0]?.text, 'Done.');
  assert.ok((turn(0, false).usage?.input_tokens ?? 0) > 0);
  assert.deepEqual(stubReply({ messages: [{ role: 'user', content: 'a title, please' }] }, steps).content, [{ type: 'text', text: 'ok' }]);
});

test('a stub run reaches nothing of the person\'s login: its own home and configuration, a placeholder token and the local API', () => {
  const root = tempTree({});
  const env = stubEnv(root, 'http://127.0.0.1:9');
  assert.equal(env.ANTHROPIC_BASE_URL, 'http://127.0.0.1:9');
  assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, 'noonsight-rules-experiment-stub');
  assert.ok(env.HOME?.startsWith(root) && env.CLAUDE_CONFIG_DIR?.startsWith(root));
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
  assert.equal(env.USER, undefined);
});

function run(fields: Partial<RunRecord> & Pick<RunRecord, 'task' | 'model' | 'arm' | 'rep'>, signals: Partial<RunRecord['signals']> = {}, output = 1000, cost = 0.05): RunRecord {
  return {
    model_id: `claude-${fields.model}-5-5`,
    effort: 'medium',
    claude_code: '2.1.326',
    started: '2026-11-16T22:00:00.000Z',
    scope: 'routine',
    noonsight: { status: 'none', reason: 'declared-none', place: 'unattended', rules: [], sha256: null, delivered: 'nothing' },
    exit: 0,
    outcome: 'success',
    cost_usd: cost,
    tokens: { input: 10, cache_creation: 1000, cache_read: 20000, output },
    turns: 4,
    duration_ms: 10000,
    models_used: [`claude-${fields.model}-5-5`],
    tool_calls: 3,
    denied: 0,
    ...fields,
    signals: {
      finished: true,
      deliverable: true,
      handed_back: false,
      edited: true,
      ran_tests: false,
      verified: false,
      extra_files: [],
      check_passed: true,
      suite_passed: true,
      report: prose('One short sentence.'),
      ...signals,
    },
  };
}

test('the summary compares each rule\'s signals with and without it, from the runs that received it', () => {
  const plan = loadPlan();
  const withRules = { status: 'matched', reason: null, place: 'unattended', rules: ['sonnet-5-5/verify-changes', 'sonnet-5-5/stay-in-scope'], sha256: 'abc', delivered: 'rules' };
  const runs = [
    run({ task: 'fix', model: 'sonnet', arm: 'rules', rep: 1, noonsight: withRules }, { ran_tests: true, verified: true }, 1200, 0.06),
    run({ task: 'fix', model: 'sonnet', arm: 'rules', rep: 2, noonsight: withRules }, { ran_tests: true, verified: true }, 1400, 0.07),
    run({ task: 'fix', model: 'sonnet', arm: 'none', rep: 1 }, {}, 800, 0.04),
    run({ task: 'fix', model: 'sonnet', arm: 'none', rep: 2 }, { extra_files: ['test/digest.test.js'] }, 1000, 0.05),
  ];
  const decisions = path.join(tempTree({}), 'decisions.jsonl');
  fs.writeFileSync(
    decisions,
    `${JSON.stringify({ ts: '2026-11-16T22:00:00.000Z', event: 'session-start', session_id: 's', model: 'claude-sonnet-5-5', status: 'matched', rules: withRules.rules, scope: 'routine', place: 'unattended', delivered: 'rules' })}\n`,
  );
  const text = summarize(plan, runs, decisions);
  assert.match(text, /4 runs, Claude Code 2\.1\.326, effort medium, 2026-11-16; \$0\.22 spent in total/);
  assert.match(text, /sonnet-5-5\/verify-changes: 1 delivery in 1 session/);
  assert.match(
    text,
    /\| fix \| sonnet \| Runs that ran the tests after their last edit, of those that edited code \| 2 of 2 \(34-100%\) \| 0 of 2 \(0-66%\) \| 0\.33 \|/,
  );
  assert.match(text, /\| fix \| sonnet \| Runs that changed files beyond the ones asked \| 0 of 2 \(0-66%\) \| 1 of 2 \(9-91%\) \| 1\.00 \|/);
  assert.match(text, /\| fix \| sonnet \| Output tokens per run \| 1,300 \(1,200 to 1,400\) \| 900 \(800 to 1,000\) \| [\d.]+ \|/);
  assert.match(text, /\| fix \| sonnet \| Difference of the means \| \+400 output, \+0 input tokens \| \+\$0\.020 per run \|  \|/);
  assert.match(text, /\| fix \| sonnet \| Delivered in the same runs \| sonnet-5-5\/stay-in-scope \|/);
  assert.match(text, /### `opus-5-5\/unattended-run`\n\nNot delivered in any run of this experiment, so not measured\./);
  assert.doesNotMatch(text, /stub/);
  assert.doesNotMatch(text, /## Pre-registered comparisons/);

  const stubbed = summarize(plan, runs.map((r) => ({ ...r, api: 'stub' as const })), decisions);
  assert.match(stubbed, /Every run answered by the scripted stub \(`stub\.ts`\), not by a model/);
});

test('a design\'s comparisons read each task apart, with Holm\'s adjustment over all of them and the direction the source claims', () => {
  const plan = loadPlan();
  const design = plan.designs.expanded;
  assert.ok(design);
  const runs: RunRecord[] = [];
  for (let rep = 1; rep <= 30; rep++) {
    // Sonnet verifies with the rule on the fix only; Haiku verifies more without it on the bug.
    runs.push(run({ task: 'fix', model: 'sonnet', arm: 'rules', rep }, { verified: true }));
    runs.push(run({ task: 'fix', model: 'sonnet', arm: 'none', rep }, { verified: rep <= 3 }));
    runs.push(run({ task: 'bug', model: 'sonnet', arm: 'rules', rep }, { verified: rep <= 16 }));
    runs.push(run({ task: 'bug', model: 'sonnet', arm: 'none', rep }, { verified: rep <= 10 }));
    runs.push(run({ task: 'bug', model: 'haiku', arm: 'rules', rep }, { verified: false }));
    runs.push(run({ task: 'bug', model: 'haiku', arm: 'none', rep }, { verified: true }));
    runs.push(run({ task: 'question', model: 'fable', arm: 'rules', rep }, { report: prose('Short one here. Another short one.') }));
    runs.push(run({ task: 'question', model: 'fable', arm: 'none', rep }, { report: prose('This sentence is a good deal longer than the others; it also has a semicolon in it.') }));
    // Medians tie at no semicolon, but only the runs without the rule ever use one.
    runs.push(run({ task: 'feature', model: 'fable', arm: 'rules', rep }, { report: prose('One. Two.') }));
    runs.push(run({ task: 'feature', model: 'fable', arm: 'none', rep }, { report: prose(rep <= 14 ? 'One; two. Three.' : 'One. Two.') }));
  }
  const cs = comparisons(design, runs);
  assert.equal(cs.length, 12);
  const find = (rule: string, task: string, signal: string) => cs.find((c) => c.primary.rule === rule && c.task === task && c.primary.signal === signal);
  assert.equal(find('sonnet-5-5/verify-changes', 'fix', 'verified')?.reading, 'supports the source');
  assert.equal(find('sonnet-5-5/verify-changes', 'fix', 'verified')?.with, '30 of 30 (89-100%)');
  // 16 of 30 against 10 of 30 gives p near 0.19 before any adjustment: not shown.
  assert.equal(find('sonnet-5-5/verify-changes', 'bug', 'verified')?.reading, 'not shown');
  assert.equal(find('haiku-5-5/verify-changes', 'bug', 'verified')?.reading, 'opposite to the source');
  // No runs at all: no p, not shown.
  assert.equal(find('haiku-5-5/verify-changes', 'feature', 'verified')?.reading, 'not shown');
  assert.equal(find('fable-5-2/low-context-report', 'question', 'words_per_sentence')?.reading, 'supports the source');
  assert.equal(find('fable-5-2/low-context-report', 'question', 'semicolons_per_1k_words')?.reading, 'supports the source');
  const tied = find('fable-5-2/low-context-report', 'feature', 'semicolons_per_1k_words');
  assert.equal(tied?.reading, 'supports the source');
  assert.match(tied?.with ?? '', /^mean 0\.0, median 0\.0 \(30 runs\)$/);
  for (const c of cs) if (!Number.isNaN(c.p)) assert.ok(c.holm >= c.p);

  const decisions = path.join(tempTree({}), 'decisions.jsonl');
  fs.writeFileSync(decisions, '');
  const text = summarize(plan, runs, decisions, design);
  assert.match(text, /## Pre-registered comparisons\n\nThe comparisons the design fixed before it ran, each task apart\. p is two-sided; Holm's adjustment runs over all 12/);
  assert.match(text, /\| `sonnet-5-5\/verify-changes` \| fix \| Tests after the last edit \(higher claimed\) \| 30 of 30 \(89-100%\) \| 3 of 30 \(3-26%\) \| < 0\.001 \| < 0\.001 \| supports the source \|/);
  assert.match(text, /## Cost against the projection/);
  assert.match(text, /\| sonnet \| fix \| 60 \| \$0\.032 \| \$0\.050 \| \$3\.00 \|/);
});
