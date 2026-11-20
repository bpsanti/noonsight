// The scoring and the summary of the rule effect experiment (experiments/rules), on recorded and
// written inputs: no model is asked anything here.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { allowedChange, armEntry, armSetup, cellKey, experimentPreset, pointerText, cells, designCells, EXPERIMENT_DIR, loadPlan, pilotCells, projection, readToken, renderProjection, runSettings, stubEnv, type RunRecord } from '../experiments/rules/run.js';
import { answerLine, answerScore, changedFiles, handsBack, partResults, prose, ruleFileRead, toolCalls, verification } from '../experiments/rules/score.js';
import { fisher, holm, mannWhitney, mcnemar, wilson } from '../experiments/rules/stats.js';
import { deliveredRules, RULES_MARKER, script, solutionFiles, STUB_REPORTS, stubReply } from '../experiments/rules/stub.js';
import { comparisons, gate, summarize, summarizePilot } from '../experiments/rules/summary.js';
import { loadConfig } from '../src/config/load.js';
import { PACKAGE_ROOT } from '../src/config/paths.js';
import { resolve } from '../src/core/resolve.js';
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
    for (const arm of design.arms) {
      assert.ok(plan.arms[arm], `${name}: arm ${arm}`);
      // Every arm resolves for every model of the design: an arm with one rule needs that rule in the model's preset.
      for (const model of Object.keys(design.cells)) armEntry(plan, arm, plan.models[model]?.id ?? model);
    }
    for (const p of design.primary) {
      assert.ok(plan.signals[p.rule], `${name}: primary rule ${p.rule}`);
      assert.ok(p.rule.startsWith(`${plan.models[p.model]?.id.replace(/^claude-/, '')}/`), `${name}: ${p.rule} is not a rule of ${p.model}`);
      for (const arm of [p.arm ?? 'rules', p.against ?? 'none']) assert.ok(design.arms.includes(arm), `${name}: ${p.rule} compares the arm ${arm}, which the design does not run`);
      for (const task of p.tasks) assert.ok(design.cells[p.model]?.includes(task), `${name}: ${p.rule} on ${task} is not a cell of the design`);
    }
  }
  for (const arm of plan.default_arms) assert.ok(plan.arms[arm], `default arm ${arm}`);
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

/** Run `node --test` in a directory, with the TAP report; without this runner's own context, which would make the child report to it instead of failing. */
function nodeTestRun(dir: string, files: string[] = []): { status: number | null; stdout: string } {
  const { NODE_TEST_CONTEXT: _, ...env } = process.env;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { cwd: dir, env, encoding: 'utf8', timeout: 60_000 });
  return { status: r.status, stdout: r.stdout ?? '' };
}

/** Whether `node --test` passes in a directory. */
function nodeTest(dir: string, files: string[] = []): boolean {
  return nodeTestRun(dir, files).status === 0;
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
    if (task.parts !== undefined) {
      // Every part needs its own work: none passes on the fixture, and the check names as many as the task declares.
      const untouched = partResults(nodeTestRun(before, check).stdout);
      const solved = partResults(nodeTestRun(after, check).stdout);
      assert.equal(untouched.length, task.parts, `${name}: the check lists ${untouched.length} parts on the fixture`);
      assert.deepEqual(untouched.filter((p) => p.ok).map((p) => p.name), [], `${name}: parts that pass before any change`);
      assert.equal(solved.filter((p) => p.ok).length, task.parts, `${name}: parts that fail on the solution`);
    }
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

test('the stub plays the reference solution, runs the tests only when the session received a verify rule, and answers side requests with a short text', () => {
  const plan = loadPlan();
  const task = plan.tasks.feature;
  assert.ok(task);
  const fixture = path.join(EXPERIMENT_DIR, 'fixtures', task.fixture);
  const solution = solutionFiles(path.join(EXPERIMENT_DIR, task.solution));
  assert.deepEqual(Object.keys(solution).sort(), ['README.md', 'src/cli.js', 'src/quote.js']);
  const steps = (rules: readonly string[]) => script(task, solution, fixture, '/work/p', rules);
  const tools = [{ name: 'Read' }];
  // The envelope as noonsight's SessionStart hook writes it (src/core/resolve.ts).
  const envelope = (ids: readonly string[]): string =>
    `${RULES_MARKER} model="claude-sonnet-5-5" scope="build">\nWorking rules the user declared for claude-sonnet-5-5, task scope "build" (delivered by noonsight, rules ${ids.join(', ')}):\nThe rules.\n</noonsight-rules>`;
  const both = ['sonnet-5-5/carry-through', 'sonnet-5-5/verify-changes'];
  const turn = (assistants: number, rules: boolean | readonly string[]) =>
    stubReply(
      {
        tools,
        system: 'You are Claude Code.',
        messages: [
          { role: 'user', content: rules === false ? 'the task' : envelope(rules === true ? both : rules) },
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
  // A rule other than a verify rule: no test run, and the plain report.
  assert.equal(turn(2, ['sonnet-5-5/carry-through']).content[0]?.text, STUB_REPORTS.rules);
  assert.deepEqual(turn(2, ['sonnet-5-5/verify-changes']).content.map((b) => b.name), ['Bash']);
  assert.equal(turn(2, false).content[0]?.text, STUB_REPORTS.none);
  assert.equal(turn(2, false).stop, 'end_turn');
  assert.equal(turn(9, false).content[0]?.text, 'Done.');
  assert.ok((turn(0, false).usage?.input_tokens ?? 0) > 0);
  assert.deepEqual(stubReply({ messages: [{ role: 'user', content: 'a title, please' }] }, steps).content, [{ type: 'text', text: 'ok' }]);

  assert.deepEqual(deliveredRules({ messages: [{ role: 'user', content: envelope(both) }] }), both);
  assert.deepEqual(deliveredRules({ system: envelope(['haiku-5-5/verify-changes']), messages: [] }), ['haiku-5-5/verify-changes']);
  assert.deepEqual(deliveredRules({ messages: [{ role: 'user', content: 'the task (delivered by noonsight, rules x/y)' }] }), []);
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
    /\| fix \| sonnet \| rules \| Runs that ran the tests after their last edit, of those that edited code \| 2 of 2 \(34-100%\) \| 0 of 2 \(0-66%\) \| 0\.33 \|/,
  );
  assert.match(text, /\| fix \| sonnet \| rules \| Runs that changed files beyond the ones asked \| 0 of 2 \(0-66%\) \| 1 of 2 \(9-91%\) \| 1\.00 \|/);
  assert.match(text, /\| fix \| sonnet \| rules \| Output tokens per run \| 1,300 \(1,200 to 1,400\) \| 900 \(800 to 1,000\) \| [\d.]+ \|/);
  assert.match(text, /\| fix \| sonnet \| rules \| Difference of the means \| \+400 output, \+0 input tokens \| \+\$0\.020 per run \|  \|/);
  assert.match(text, /\| fix \| sonnet \| rules \| Delivered in the same runs \| sonnet-5-5\/stay-in-scope \|/);
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
  // No runs at all: not run, and left out of Holm's adjustment.
  const unrun = find('haiku-5-5/verify-changes', 'feature', 'verified');
  assert.equal(unrun?.reading, 'not run');
  assert.ok(Number.isNaN(unrun?.holm));
  assert.equal(find('fable-5-2/low-context-report', 'question', 'words_per_sentence')?.reading, 'supports the source');
  assert.equal(find('fable-5-2/low-context-report', 'question', 'semicolons_per_1k_words')?.reading, 'supports the source');
  const tied = find('fable-5-2/low-context-report', 'feature', 'semicolons_per_1k_words');
  assert.equal(tied?.reading, 'supports the source');
  assert.match(tied?.with ?? '', /^mean 0\.0, median 0\.0 \(30 runs\)$/);
  for (const c of cs) if (!Number.isNaN(c.p) && c.reading !== 'not run') assert.ok(c.holm >= c.p);

  const decisions = path.join(tempTree({}), 'decisions.jsonl');
  fs.writeFileSync(decisions, '');
  const text = summarize(plan, runs, decisions, design);
  assert.match(text, /## Pre-registered comparisons\n\nThe comparisons the design fixed before it ran, each task apart\. p is two-sided; Holm's adjustment runs over the 7 that ran \(5 of the 12 have no run in one of their arms, so they are not run\)/);
  assert.match(text, /\| `sonnet-5-5\/verify-changes` \| fix \| rules against none \| Tests after the last edit \(higher claimed\) \| 30 of 30 \(89-100%\) \| 3 of 30 \(3-26%\) \| < 0\.001 \| < 0\.001 \| supports the source \|/);
  assert.match(text, /## Cost against the projection/);
  assert.match(text, /\| sonnet \| fix \| 60 \| \$0\.032 \| \$0\.050 \| \$3\.00 \|/);
});

test('an arm with one rule is the preset with every other rule that ships on for the model turned off, so noonsight delivers that rule alone', () => {
  const plan = loadPlan();
  assert.deepEqual(armEntry(plan, 'rules', 'claude-sonnet-5-5'), { use: 'preset' });
  assert.deepEqual(armEntry(plan, 'none', 'claude-sonnet-5-5'), { use: 'none' });
  assert.deepEqual(armEntry(plan, 'verify', 'claude-sonnet-5-5'), { use: 'preset', disable: ['sonnet-5-5/carry-through', 'sonnet-5-5/stay-in-scope'] });
  assert.deepEqual(armEntry(plan, 'carry', 'claude-sonnet-5-5'), { use: 'preset', disable: ['sonnet-5-5/stay-in-scope', 'sonnet-5-5/verify-changes'] });
  assert.deepEqual(armEntry(plan, 'verify', 'claude-haiku-5-5'), { use: 'preset', disable: ['haiku-5-5/carry-through'] });
  assert.deepEqual(armEntry(plan, 'carry', 'claude-haiku-5-5'), { use: 'preset', disable: ['haiku-5-5/verify-changes'] });
  assert.throws(() => armEntry(plan, 'verify', 'claude-fable-5-2'), /the arm "verify" keeps the rule "verify-changes", which the preset does not have for claude-fable-5-2/);
  assert.throws(() => armEntry(plan, 'nothing', 'claude-sonnet-5-5'), /unknown arm "nothing"/);

  // What noonsight decides for each arm, in the place and scopes the runs have, with and without the code-edit trigger.
  const delivered = (arm: string, model: string, scope: string, triggers: 'code-edit'[] = []): readonly string[] => {
    const file = path.join(tempTree({}), 'noonsight.json');
    fs.writeFileSync(file, JSON.stringify({ version: 1, models: { [model]: armEntry(plan, arm, model) }, session: { unattended_when_env: [plan.unattended_env] } }));
    const d = resolve(loadConfig(file, { presetsDir: path.join(PACKAGE_ROOT, 'presets') }, {}), { model, scope, place: 'unattended', triggers });
    return d.status === 'matched' ? d.rules : [];
  };
  for (const [model, prefix] of [['claude-sonnet-5-5', 'sonnet-5-5'], ['claude-haiku-5-5', 'haiku-5-5']] as const)
    for (const scope of ['routine', 'build'])
      for (const triggers of [[], ['code-edit']] as 'code-edit'[][]) {
        assert.deepEqual(delivered('verify', model, scope, triggers), [`${prefix}/verify-changes`], `${model} ${scope} ${triggers}`);
        assert.deepEqual(delivered('carry', model, scope, triggers), [`${prefix}/carry-through`], `${model} ${scope} ${triggers}`);
        assert.ok(delivered('rules', model, scope, triggers).length >= 2);
        assert.deepEqual(delivered('none', model, scope, triggers), []);
      }
  assert.deepEqual(delivered('rules', 'claude-sonnet-5-5', 'routine'), ['sonnet-5-5/carry-through', 'sonnet-5-5/stay-in-scope', 'sonnet-5-5/verify-changes']);
});

test('a pointer arm replaces the rule with a short rule naming a file that holds its text, delivered where the rule would be', () => {
  const plan = loadPlan();
  const dir = tempTree({});
  const preset = experimentPreset();
  const setup = armSetup(plan, 'pointer', 'claude-sonnet-5-5', dir, preset);
  assert.deepEqual(setup.entry, {
    use: 'preset',
    disable: ['sonnet-5-5/carry-through', 'sonnet-5-5/stay-in-scope'],
    add: [{ id: 'experiment/verify-changes-pointer', file: 'verify-changes-pointer.md', replaces: 'sonnet-5-5/verify-changes' }],
  });
  assert.equal(setup.ruleFile, path.join(dir, 'verify-changes.md'));
  assert.equal(setup.files['verify-changes-pointer.md'], `${pointerText(path.join(dir, 'verify-changes.md'))}\n`);
  const inline = preset.models.get('claude-sonnet-5-5')?.find((r) => r.id === 'sonnet-5-5/verify-changes')?.text.trim();
  assert.equal(setup.files['verify-changes.md'], `${inline}\n`);
  assert.equal(armSetup(plan, 'verify', 'claude-sonnet-5-5', dir, preset).ruleFile, null);

  // noonsight delivers the pointer exactly where it would deliver the rule inline, and nothing else.
  for (const model of ['claude-sonnet-5-5', 'claude-haiku-5-5'])
    for (const scope of ['routine', 'build'])
      for (const triggers of [[], ['code-edit']] as 'code-edit'[][]) {
        const d = tempTree({});
        const s = armSetup(plan, 'pointer', model, d, preset);
        for (const [file, text] of Object.entries(s.files)) fs.writeFileSync(path.join(d, file), text);
        fs.writeFileSync(path.join(d, 'noonsight.json'), JSON.stringify({ version: 1, models: { [model]: s.entry }, session: { unattended_when_env: [plan.unattended_env] } }));
        const decision = resolve(loadConfig(path.join(d, 'noonsight.json'), { presetsDir: path.join(PACKAGE_ROOT, 'presets') }, {}), { model, scope, place: 'unattended', triggers });
        assert.equal(decision.status, 'matched');
        if (decision.status !== 'matched') continue;
        assert.deepEqual(decision.rules, ['experiment/verify-changes-pointer']);
        assert.match(decision.text, new RegExp(`is in the file ${path.join(d, 'verify-changes.md').replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\. Read that file`));
        assert.doesNotMatch(decision.text, /gets a real check that exercises it/);
      }
});

test('ruleFileRead says whether and when the session opened the rule file, refused attempts apart', () => {
  const project = '/work/project';
  const file = '/lab/rules/verify-changes.md';
  const call = (id: string, name: string, input: Record<string, unknown>): [string, string, Record<string, unknown>] => [id, name, input];
  const before = toolCalls(stream([call('1', 'Read', { file_path: file }), call('2', 'Edit', { file_path: `${project}/src/a.js` })]));
  assert.deepEqual(ruleFileRead(before, file, project), { read: true, attempts: 1, first_call: 1, before_first_edit: true });
  const after = toolCalls(stream([call('1', 'Read', { file_path: `${project}/src/a.js` }), call('2', 'Edit', { file_path: `${project}/src/a.js` }), call('3', 'Bash', { command: `cat ${file}` })]));
  assert.deepEqual(ruleFileRead(after, file, project), { read: true, attempts: 1, first_call: 3, before_first_edit: false });
  const refused = toolCalls(stream([call('1', 'Read', { file_path: file })], ['1']));
  assert.deepEqual(ruleFileRead(refused, file, project), { read: false, attempts: 1, first_call: null, before_first_edit: null });
  // A read with no edit at all still counts as before the first edit.
  const readOnly = toolCalls(stream([call('1', 'Grep', { pattern: 'check', path: file })]));
  assert.equal(ruleFileRead(readOnly, file, project).before_first_edit, true);
  assert.equal(ruleFileRead(toolCalls(stream([])), file, project).read, false);
});

test('the stub reads the rule file first when the session received the pointer rule, then tests as with the rule inline', () => {
  const plan = loadPlan();
  const task = plan.tasks.fix;
  assert.ok(task);
  const solution = solutionFiles(path.join(EXPERIMENT_DIR, task.solution));
  const fixture = path.join(EXPERIMENT_DIR, 'fixtures', task.fixture);
  const steps = script(task, solution, fixture, '/work/p', ['experiment/verify-changes-pointer'], '/lab/rules/verify-changes.md');
  assert.deepEqual(steps[0]?.calls, [{ name: 'Read', input: { file_path: '/lab/rules/verify-changes.md' } }]);
  assert.ok(steps.some((s) => s.calls?.some((c) => c.name === 'Bash' && c.input.command === 'npm test')));
  const inline = script(task, solution, fixture, '/work/p', ['sonnet-5-5/verify-changes'], '/lab/rules/verify-changes.md');
  assert.equal(inline.length, steps.length - 1);
});

test('the single-rule design runs Sonnet and Haiku on fix and bug in five arms, 30 times each, within a cap above its projection', () => {
  const plan = loadPlan();
  const design = plan.designs['single-rule'];
  assert.ok(design);
  const all = designCells(plan, design);
  assert.equal(all.length, 2 * 2 * 5 * 30);
  assert.deepEqual(all.slice(0, 10).map(cellKey), [
    'fix.sonnet.rules.1',
    'fix.sonnet.verify.1',
    'fix.sonnet.pointer.1',
    'fix.sonnet.carry.1',
    'fix.sonnet.none.1',
    'fix.haiku.rules.1',
    'fix.haiku.verify.1',
    'fix.haiku.pointer.1',
    'fix.haiku.carry.1',
    'fix.haiku.none.1',
  ]);
  const p = projection(plan, design);
  assert.ok(Math.abs(p.expected - 14.55) < 0.01, String(p.expected));
  assert.ok(p.expected <= 20 && p.expected < design.cap_usd && design.cap_usd < p.ceiling);
  assert.equal(design.cap_usd, 25);
  const cs = comparisons(design, []);
  assert.equal(cs.length, 21);
  assert.equal(cs.filter((c) => c.arms[0] === 'pointer' && c.arms[1] === 'verify').length, 7);
});

test('a comparison of two named arms reads the direction found where the source claims none, and compares cost per run', () => {
  const plan = loadPlan();
  const design = plan.designs['single-rule'];
  assert.ok(design);
  const one = (model: string, rule: string) => ({ status: 'matched', reason: null, place: 'unattended', rules: [`${model}-5-5/${rule}`], sha256: 'abc', delivered: 'rules' });
  const runs: RunRecord[] = [];
  for (let rep = 1; rep <= 30; rep++)
    for (const task of ['fix', 'bug'])
      for (const model of ['sonnet', 'haiku']) {
        runs.push(run({ task, model, arm: 'none', rep }, { verified: false }, 700, 0.02 + rep / 10000));
        // Verify alone tests after every edit and costs more; carry-through alone tests less often than none, at the same cost.
        runs.push(run({ task, model, arm: 'verify', rep, noonsight: one(model, 'verify-changes') }, { verified: true }, 1200, 0.03 + rep / 10000));
        runs.push(run({ task, model, arm: 'carry', rep, noonsight: one(model, 'carry-through') }, { verified: false }, 700, 0.02 + rep / 10000));
        runs.push(run({ task, model, arm: 'rules', rep, noonsight: { ...one(model, 'verify-changes'), rules: [`${model}-5-5/carry-through`, `${model}-5-5/verify-changes`] } }, { verified: true }, 1300, 0.032 + rep / 10000));
      }
  const cs = comparisons(design, runs);
  const find = (rule: string, task: string, signal: string) => cs.find((c) => c.primary.rule === rule && c.task === task && c.primary.signal === signal);
  assert.deepEqual(find('sonnet-5-5/verify-changes', 'fix', 'verified')?.arms, ['verify', 'none']);
  assert.equal(find('sonnet-5-5/verify-changes', 'fix', 'verified')?.reading, 'supports the source');
  assert.equal(find('sonnet-5-5/carry-through', 'fix', 'verified')?.reading, 'not shown');
  assert.equal(find('haiku-5-5/verify-changes', 'bug', 'cost_usd')?.reading, 'supports the source');
  assert.match(find('haiku-5-5/verify-changes', 'bug', 'cost_usd')?.with ?? '', /^mean \$0\.0316, median \$0\.031\d \(30 runs\)$/);
  assert.equal(find('sonnet-5-5/carry-through', 'bug', 'cost_usd')?.reading, 'not shown');
  assert.equal(find('haiku-5-5/carry-through', 'bug', 'cost_usd')?.reading, 'not shown');

  // Where the source claims no direction, a difference is read as the direction found.
  const lower = runs.map((r) => (r.arm === 'carry' && r.model === 'haiku' ? { ...r, cost_usd: r.cost_usd - 0.01 } : r));
  assert.equal(comparisons(design, lower).find((c) => c.primary.rule === 'haiku-5-5/carry-through' && c.task === 'fix' && c.primary.signal === 'cost_usd')?.reading, 'lower');

  const decisions = path.join(tempTree({}), 'decisions.jsonl');
  fs.writeFileSync(decisions, '');
  const text = summarize(plan, runs, decisions, design);
  assert.match(text, /\| `sonnet-5-5\/carry-through` \| fix \| carry against none \| Tests after the last edit \(no direction claimed\) \| 0 of 30 \(0-11%\) \| 0 of 30 \(0-11%\) \| 1\.00 \| 1\.00 \| not shown \|/);
  assert.match(text, /\| fix \| sonnet \| verify: sonnet-5-5\/verify-changes \| 30 \|/);
  assert.match(text, /\| fix \| sonnet \| verify \| Delivered in the same runs \| no other rule \|/);
  assert.match(text, /## Each arm against none/);
  assert.match(text, /\| sonnet \| fix \| verify \| sonnet-5-5\/verify-changes \| 30 \| 30 of 30 \(89-100%\) \| \+100 points \| 100% \| \$0\.0316 \| \+\$0\.0100 \| 83% \| 4\.0 \|/);
  assert.match(text, /\| sonnet \| fix \| none \| none \| 30 \| 0 of 30 \(0-11%\) \|  \|  \| \$0\.0216 \|  \|  \| 4\.0 \|/);
  assert.match(text, /\| sonnet \| fix \| rules \| sonnet-5-5\/carry-through, sonnet-5-5\/verify-changes \| 30 \| 30 of 30 \(89-100%\) \| \+100 points \|  \| \$0\.033\d \| \+\$0\.0120 \|  \| 4\.0 \|/);
});

test('partResults reads the top-level parts of a TAP report, and nothing else', () => {
  const tap = ['TAP version 13', '# Subtest: part a: one', 'ok 1 - part a: one', '    ok 1 - part inner: a subtest', 'not ok 2 - part ORCH-12: two', 'ok 3 - not a part', 'not ok 4 - part changelog: three', '1..4'].join('\n');
  assert.deepEqual(partResults(tap), [
    { name: 'a', ok: true },
    { name: 'ORCH-12', ok: false },
    { name: 'changelog', ok: false },
  ]);
  assert.deepEqual(partResults(''), []);
});

test('a long task\'s parts are independent: one part\'s change passes that part alone', () => {
  const plan = loadPlan();
  const only = (taskName: string, files: string[]): string[] => {
    const task = plan.tasks[taskName];
    assert.ok(task?.check);
    const dir = project(task.fixture);
    for (const f of files) fs.copyFileSync(path.join(EXPERIMENT_DIR, task.solution, f), path.join(dir, f));
    fs.mkdirSync(path.join(dir, 'check'));
    fs.copyFileSync(path.join(EXPERIMENT_DIR, task.check), path.join(dir, 'check', path.basename(task.check)));
    return partResults(nodeTestRun(dir, [path.join('check', path.basename(task.check))]).stdout)
      .filter((p) => p.ok)
      .map((p) => p.name);
  };
  assert.deepEqual(only('migrate', ['src/reports/fx.js']), ['fx']);
  assert.deepEqual(only('migrate', ['CHANGELOG.md']), ['changelog']);
  assert.deepEqual(only('backlog', ['src/dates.js']), ['ORCH-11']);
  assert.deepEqual(only('backlog', ['src/parse.js']), ['ORCH-12', 'ORCH-14']);
  assert.deepEqual(only('codes', ['src/fields/floors.js']), ['floors']);
  assert.deepEqual(only('codes', ['src/index.js']), ['form']);
  assert.deepEqual(only('codes', ['package.json']), ['version']);
  assert.deepEqual(only('codes', ['CHANGELOG.md']), ['changelog']);
  assert.deepEqual(only('triage', ['src/stock.js']), ['PAN-21', 'PAN-24', 'PAN-25']);
  assert.deepEqual(only('triage', ['README.md']), ['PAN-33']);
  assert.deepEqual(only('triage', ['TICKETS.md']), ['closing']);
});

test('a design sets the effort, budget and time limit of its models', () => {
  const plan = loadPlan();
  const long = plan.designs.long;
  assert.ok(long);
  assert.deepEqual(runSettings(plan, long, 'sonnet'), { effort: 'low', budget_usd: 2.5, timeout_ms: 40 * 60 * 1000 });
  // A model the design sets nothing for runs at the plan's effort and budget, within the design's time limit.
  assert.deepEqual(runSettings(plan, long, 'opus'), { effort: plan.effort, budget_usd: plan.models.opus?.budget_usd, timeout_ms: 40 * 60 * 1000 });
  assert.deepEqual(runSettings(plan, undefined, 'sonnet'), { effort: plan.effort, budget_usd: plan.models.sonnet?.budget_usd, timeout_ms: 15 * 60 * 1000 });

});

test('the long design runs Sonnet and Haiku on two long tasks, 40 times per arm, after a pilot of the arm without rules, within caps above its projection', () => {
  const plan = loadPlan();
  const design = plan.designs.long;
  assert.ok(design?.pilot);
  const all = designCells(plan, design);
  assert.equal(all.length, 2 * 2 * 2 * 40);
  assert.deepEqual(Object.keys(design.cells), ['sonnet', 'haiku']);
  for (const [model, tasks] of Object.entries(design.cells)) for (const task of tasks) assert.ok(plan.tasks[task]?.parts, `${model} on ${task} is not a long task`);
  const pilot = pilotCells(plan, design);
  assert.equal(pilot.length, 2 * 2 * 5);
  assert.ok(pilot.every((c) => c.arm === 'none'));
  // Every primary comparison of the design reads the completion of a long task, the carry-through rule alone against no rule.
  assert.deepEqual(design.arms, ['carry', 'none']);
  for (const p of design.primary) {
    assert.equal(p.signal, 'completed');
    assert.deepEqual([p.arm, p.against], ['carry', 'none']);
    assert.equal(p.rule, `${p.model}-5-5/carry-through`);
  }

  const p = projection(plan, design);
  assert.ok(Math.abs(p.expected - 74.4) < 0.01, String(p.expected));
  assert.ok(p.expected < design.cap_usd && design.cap_usd < p.ceiling);
  const q = projection(plan, design, design.pilot.reps, [design.pilot.arm]);
  assert.ok(Math.abs(q.expected - 4.65) < 0.01, String(q.expected));
  assert.ok(q.expected < design.pilot.cap_usd);
  const text = renderProjection(plan, design);
  assert.match(text, /Expected in total: \$74\.40, at list price as Claude Code reports it\. The cap is \$110\.00/);
  assert.match(text, /Before it, the pilot runs 20 times: 5 runs of the arm none per model and task, expected \$4\.65, within a cap of \$10\.00\./);
  assert.match(text, /Expected for the pilot and the design together: \$79\.05; the two caps together: \$120\.00\./);
});

test('the stub stops a long task halfway without a rule against early stopping and hands the rest back, and does every part with one', () => {
  const plan = loadPlan();
  const task = plan.tasks.migrate;
  assert.ok(task);
  const fixture = path.join(EXPERIMENT_DIR, 'fixtures', task.fixture);
  const solution = solutionFiles(path.join(EXPERIMENT_DIR, task.solution));
  assert.equal(Object.keys(solution).length, 19);
  const without = script(task, solution, fixture, '/work/p', []);
  assert.equal(without[1]?.calls?.length, 9);
  assert.equal(without.at(-1)?.text, STUB_REPORTS.stopped);
  assert.ok(handsBack(STUB_REPORTS.stopped));
  // A verify rule alone does not keep the script going; carry-through or Opus's unattended-run does.
  assert.equal(script(task, solution, fixture, '/work/p', ['haiku-5-5/verify-changes']).at(-1)?.text, STUB_REPORTS.stopped);
  const carry = script(task, solution, fixture, '/work/p', ['sonnet-5-5/carry-through']);
  assert.equal(carry[1]?.calls?.length, 19);
  assert.ok(!carry.some((s) => s.calls?.some((c) => c.name === 'Bash')));
  assert.equal(carry.at(-1)?.text, STUB_REPORTS.rules);
  assert.equal(script(task, solution, fixture, '/work/p', ['opus-5-5/unattended-run'])[1]?.calls?.length, 19);
  const both = script(task, solution, fixture, '/work/p', ['sonnet-5-5/carry-through', 'sonnet-5-5/verify-changes']);
  assert.deepEqual(both[2]?.calls?.map((c) => c.input.command), ['npm test']);
});

test('the summary reads a long design: completion with and without the rule, how runs ended, and the pilot\'s gate', () => {
  const plan = loadPlan();
  const design = plan.designs.long;
  assert.ok(design?.pilot);
  const long = (fields: Parameters<typeof run>[0], done: number, total: number, outcome = 'success', handedBack = false): RunRecord => {
    const undone = Array.from({ length: total - done }, (_, i) => `p${i + 1}`);
    return run({ outcome, ...fields }, { parts: { done, total, undone }, completed: done === total, handed_back: handedBack, finished: done === total && !handedBack }, 5000, 0.4);
  };
  const runs: RunRecord[] = [];
  for (let rep = 1; rep <= 40; rep++) {
    // Sonnet stops halfway through the migration in half the runs without its rule, and never with it.
    runs.push(long({ task: 'migrate', model: 'sonnet', arm: 'carry', rep }, 19, 19));
    runs.push(long({ task: 'migrate', model: 'sonnet', arm: 'none', rep }, rep <= 20 ? 9 : 19, 19, 'success', rep <= 20));
    // Haiku runs out of budget twice in each arm on the backlog.
    runs.push(long({ task: 'backlog', model: 'haiku', arm: 'carry', rep }, rep <= 2 ? 6 : 8, 8, rep <= 2 ? 'error_max_budget_usd' : 'success'));
    runs.push(long({ task: 'backlog', model: 'haiku', arm: 'none', rep }, rep <= 2 ? 6 : 8, 8, rep <= 2 ? 'error_max_budget_usd' : 'success'));
  }
  const cs = comparisons(design, runs);
  assert.equal(cs.length, 4);
  const find = (model: string, task: string) => cs.find((c) => c.primary.model === model && c.task === task);
  assert.equal(find('sonnet', 'migrate')?.reading, 'supports the source');
  assert.equal(find('sonnet', 'migrate')?.with, '40 of 40 (91-100%)');
  assert.equal(find('haiku', 'backlog')?.reading, 'not shown');
  assert.equal(find('sonnet', 'backlog')?.reading, 'not run');

  const decisions = path.join(tempTree({}), 'decisions.jsonl');
  fs.writeFileSync(decisions, '');
  const text = summarize(plan, runs, decisions, design);
  // The header gives the effort the runs recorded, not the plan's.
  assert.match(summarize(plan, runs.map((r) => ({ ...r, effort: 'low' })), decisions, design), /^160 runs, Claude Code [^,]+, effort low, /m);
  assert.match(text, /Holm's adjustment runs over the 2 that ran \(2 of the 4 have no run in one of their arms, so they are not run\)/);
  assert.match(text, /\| `sonnet-5-5\/carry-through` \| migrate \| carry against none \| Every part done \(higher claimed\) \| 40 of 40 \(91-100%\) \| 20 of 40 \(35-65%\) \| < 0\.001 \| < 0\.001 \| supports the source \|/);
  assert.match(text, /## Long tasks: how the runs ended/);
  assert.match(text, /\| migrate \| sonnet \| none \| 40 \| 20 of 40 \(35-65%\) \| 14\.0 \(9\.0 to 19\.0\) of 19 \| success 40 \| 20 of 20 \| 20 of 20 \| p1 \(20\), p10 \(20\), p2 \(20\) \|/);
  assert.match(text, /\| backlog \| haiku \| carry \| 40 \| 38 of 40 \(83-99%\) \| 7\.9 \(6\.0 to 8\.0\) of 8 \| error_max_budget_usd 2, success 38 \| 0 of 2 \| 0 of 0 \| p1 \(2\), p2 \(2\) \|/);

  // The pilot: Sonnet's migration stopped short in 3 of 5 runs, Haiku's backlog in 1, Haiku's migration in none; Sonnet's backlog did not run.
  const pilot: RunRecord[] = [];
  for (let rep = 1; rep <= 5; rep++) {
    pilot.push(long({ task: 'migrate', model: 'sonnet', arm: 'none', rep }, rep <= 3 ? 9 : 19, 19));
    pilot.push(long({ task: 'backlog', model: 'haiku', arm: 'none', rep }, rep <= 1 ? 5 : 8, 8));
    pilot.push(long({ task: 'migrate', model: 'haiku', arm: 'none', rep }, 19, 19));
  }
  const reading = gate(design, pilot);
  assert.deepEqual(
    reading.map((g) => [g.model, g.task, g.incomplete, g.enters]),
    [
      ['sonnet', 'migrate', 3, true],
      ['sonnet', 'backlog', 0, false],
      ['haiku', 'migrate', 0, false],
      ['haiku', 'backlog', 1, false],
    ],
  );
  const pilotText = summarizePilot(plan, design, pilot.map((r) => ({ ...r, api: 'stub' as const })));
  assert.match(pilotText, /^# Rule effect experiment: pilot\n\nEvery run answered by the scripted stub/);
  assert.match(pilotText, /\| sonnet \| migrate \| 5 \| 3 of 5 \| 13\.0 \(9\.0 to 19\.0\) of 19 \| yes \| \$0\.400 \| \$0\.350 \|/);
  assert.match(pilotText, /1 of the 4 cells enter: sonnet on migrate, 80 runs each \(40 per arm\), 80 runs in all\./);
  assert.match(pilotText, /At the expected cost per run, they cost \$28\.00; at the cost the pilot measured, \$32\.00\. The design's cap is \$110\.00\./);
});

test('the backlog check reads the sort order of the blocks under a heading that names them, and not from an unrelated paragraph', () => {
  const plan = loadPlan();
  const task = plan.tasks.backlog;
  assert.ok(task?.check);
  const sorted = (readme: string): boolean => {
    const dir = project(task.fixture, task.solution);
    fs.writeFileSync(path.join(dir, 'README.md'), readme);
    fs.mkdirSync(path.join(dir, 'check'));
    fs.copyFileSync(path.join(EXPERIMENT_DIR, task.check ?? ''), path.join(dir, 'check', 'backlog.test.js'));
    return partResults(nodeTestRun(dir, [path.join('check', 'backlog.test.js')]).stdout).some((p) => p.name === 'ORCH-15' && p.ok);
  };
  assert.ok(sorted('# orchard-log\n\n### `blocks <file>`\n\nPrints the crates of each block, one line per block, sorted by block name.\n'));
  assert.ok(sorted('# orchard-log\n\n`blocks` lists the blocks, heaviest first.\n'));
  assert.equal(sorted('# orchard-log\n\n### `blocks <file>`\n\nPrints the crates of each block.\n\n`summary` prints one line per variety, by name.\n'), false);
});

test('the harder design runs Sonnet and Haiku on the two harder long tasks, 40 times per arm, after a pilot of the arm without rules, within caps above its projection', () => {
  const plan = loadPlan();
  const design = plan.designs.harder;
  assert.ok(design?.pilot);
  assert.deepEqual(design.cells, { sonnet: ['codes', 'triage'], haiku: ['codes', 'triage'] });
  assert.deepEqual(design.arms, ['carry', 'none']);
  assert.equal(designCells(plan, design).length, 2 * 2 * 2 * 40);
  const pilot = pilotCells(plan, design);
  assert.equal(pilot.length, 2 * 2 * 5);
  assert.ok(pilot.every((c) => c.arm === 'none'));
  assert.deepEqual(design.pilot, { reps: 5, arm: 'none', min_incomplete: 2, cap_usd: 10 });
  for (const model of ['sonnet', 'haiku']) assert.equal(runSettings(plan, design, model).effort, 'low');
  for (const p of design.primary) {
    assert.equal(p.signal, 'completed');
    assert.deepEqual([p.arm, p.against, p.direction], ['carry', 'none', 'higher']);
    assert.equal(p.rule, `${p.model}-5-5/carry-through`);
  }
  assert.equal(plan.tasks.codes?.parts, 39);
  assert.equal(plan.tasks.triage?.parts, 12);

  const p = projection(plan, design);
  assert.ok(Math.abs(p.expected - 80.8) < 0.01, String(p.expected));
  assert.ok(p.expected < design.cap_usd && design.cap_usd < p.ceiling);
  const q = projection(plan, design, design.pilot.reps, [design.pilot.arm]);
  assert.ok(Math.abs(q.expected - 5.05) < 0.01, String(q.expected));
  assert.ok(q.expected < design.pilot.cap_usd);
  assert.equal(design.pilot.cap_usd + design.cap_usd, 120);
});

/** The reference solution of a task, with some of its files replaced, and the parts the hidden check passes there. */
function partsWith(taskName: string, files: Record<string, string>): string[] {
  const plan = loadPlan();
  const task = plan.tasks[taskName];
  assert.ok(task?.check);
  const dir = project(task.fixture, task.solution);
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
  fs.mkdirSync(path.join(dir, 'check'));
  fs.copyFileSync(path.join(EXPERIMENT_DIR, task.check), path.join(dir, 'check', path.basename(task.check)));
  return partResults(nodeTestRun(dir, [path.join('check', path.basename(task.check))]).stdout)
    .filter((p) => p.ok)
    .map((p) => p.name);
}

/** A file of a task's reference solution, edited. */
function solutionWith(taskName: string, file: string, edit: (text: string) => string): Record<string, string> {
  const plan = loadPlan();
  const text = fs.readFileSync(path.join(EXPERIMENT_DIR, plan.tasks[taskName]?.solution ?? '', file), 'utf8');
  const edited = edit(text);
  assert.notEqual(edited, text, `the edit of ${file} changed nothing`);
  return { [file]: edited };
}

test('the triage check accepts every choice the tickets leave open, and refuses what does not do what they ask', () => {
  const passes = (part: string, files: Record<string, string>): boolean => partsWith('triage', files).includes(part);
  // PAN-24: any window shorter than 7 days for produce and longer than 7 for canned goods.
  assert.ok(passes('PAN-24', solutionWith('triage', 'src/stock.js', (t) => t.replace('{ produce: 3, canned: 30 }', '{ produce: 5, canned: 14, dairy: 4 }'))));
  assert.ok(passes('PAN-24', solutionWith('triage', 'src/stock.js', (t) => t.replace('{ produce: 3, canned: 30 }', '{ produce: 1, canned: 8 }'))));
  assert.equal(passes('PAN-24', solutionWith('triage', 'src/stock.js', (t) => t.replace('{ produce: 3, canned: 30 }', '{ produce: 7, canned: 30 }'))), false);
  // PAN-25: whole numbers as well as one decimal.
  assert.ok(passes('PAN-25', solutionWith('triage', 'src/stock.js', (t) => t.replace('return Number(qty.toFixed(1));', 'return Math.round(qty);'))));
  assert.ok(passes('PAN-25', solutionWith('triage', 'src/stock.js', (t) => t.replace('return Number(qty.toFixed(1));', 'return qty.toFixed(1);'))));
  assert.equal(passes('PAN-25', solutionWith('triage', 'src/stock.js', (t) => t.replace('return Number(qty.toFixed(1));', 'return qty;'))), false);
  // PAN-32: any new name for the option, read however the code reads options, as long as --min still works.
  for (const read of ["opts.threshold ?? opts.min", "opts['at-most'] ?? opts.min", 'opts.maxQty ?? opts.min'])
    assert.ok(passes('PAN-32', solutionWith('triage', 'src/cli.js', (t) => t.replace('opts.below ?? opts.min', read).replace("opts[a.slice(2)] = next;", read.includes('maxQty') ? "opts[a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = next;" : "opts[a.slice(2)] = next;"))), read);
  assert.equal(passes('PAN-32', solutionWith('triage', 'src/cli.js', (t) => t.replace('opts.below ?? opts.min', 'opts.min'))), false);
  assert.equal(passes('PAN-32', solutionWith('triage', 'src/cli.js', (t) => t.replace('opts.below ?? opts.min', 'opts.below'))), false);
  // PAN-29: with long windows for every category, which PAN-24 allows.
  assert.ok(passes('PAN-29', solutionWith('triage', 'src/stock.js', (t) => t.replace('{ produce: 3, canned: 30 }', '{ produce: 3, canned: 60, dry: 60, frozen: 365, hygiene: 3650 }'))));
  // PAN-29: JSON printed over several lines.
  assert.ok(passes('PAN-29', solutionWith('triage', 'src/cli.js', (t) => t.replace('io.out(JSON.stringify(items));', 'io.out(JSON.stringify(items, null, 2));'))));
  // PAN-26: the shelf shown in any form.
  assert.ok(passes('PAN-26', solutionWith('triage', 'src/cli.js', (t) => t.replace('it.shelf ? `shelf ${it.shelf}` :', 'it.shelf ? `[${it.shelf}]` :'))));
  // Closing: tickets moved as one line each, and not as tickets left in Open with a list under Done.
  const fixtureTickets = fs.readFileSync(path.join(EXPERIMENT_DIR, 'fixtures', 'pantry-stock', 'TICKETS.md'), 'utf8');
  const closed = ['21', '22', '23', '24', '25', '26', '27', '29', '30', '31', '32', '33'].map((n) => `- PAN-${n}: done.`).join('\n');
  const asLines = fixtureTickets.replace(/## Open\n[\s\S]*?## Done\n/, `## Open\n\n### PAN-28 · Move the stock to SQLite?\n\nParked.\n\n## Done\n\n${closed}\n`);
  assert.ok(passes('closing', { 'TICKETS.md': asLines }));
  assert.equal(passes('closing', { 'TICKETS.md': fixtureTickets.replace('## Done\n', `## Done\n\n${closed}\n`) }), false);
  assert.equal(passes('closing', { 'TICKETS.md': asLines.replace('## Open\n\n### PAN-28 · Move the stock to SQLite?\n\nParked.\n', '## Open\n').replace('## Done\n', '## Done\n\n- PAN-28: parked.\n') }), false);
});

test('the codes check reads the changelog under any heading for 2.0.0 above 1.4.2, and every field by the code its check fails with', () => {
  const passes = (part: string, files: Record<string, string>): boolean => partsWith('codes', files).includes(part);
  const changelog = (edit: (t: string) => string) => solutionWith('codes', 'CHANGELOG.md', edit);
  assert.ok(passes('changelog', changelog((t) => t.replace('## 2.0.0', '## [2.0.0] - 2026-11-20'))));
  assert.ok(passes('changelog', changelog((t) => t.replace('## 2.0.0', '### 2.0.0 (breaking)'))));
  assert.equal(passes('changelog', changelog((t) => t.replace('## 2.0.0\n\n- Breaking: every validator', '## 2.0.0\n\n## 1.9.9\n\n- Breaking: every validator'))), false);
  const below = fs.readFileSync(path.join(EXPERIMENT_DIR, 'fixtures', 'permit-forms', 'CHANGELOG.md'), 'utf8') + '\n## 2.0.0\n\n- Errors in place of true and false.\n';
  assert.equal(passes('changelog', { 'CHANGELOG.md': below }), false);
  // A field passes with messages of its own and the error built by a helper; a wrong code or a value valid before that now fails does not.
  const floors = (edit: (t: string) => string) => solutionWith('codes', 'src/fields/floors.js', edit);
  assert.ok(passes('floors', floors((t) => t.replace(/message: "[^"]*"/g, "message: 'Please check this value.'"))));
  assert.ok(passes('floors', floors((t) => t.replace(/return \{ code: ('PF-\d+'), message: ("[^"]*") \};/g, 'return error($1, $2);').replace('function validate', 'const error = (code, message) => Object.freeze({ code, message });\n\nfunction validate'))));
  assert.equal(passes('floors', floors((t) => t.replace(/PF-\d+/, 'PF-000'))), false);
  assert.equal(passes('floors', floors((t) => t.replace('Number(text) > 12', 'Number(text) > 11'))), false);
});

test('readToken reads a token only its owner can read, and never for a stub run', () => {
  const dir = tempTree({});
  const file = path.join(dir, 'token');
  fs.writeFileSync(file, 'sk-placeholder\n', { mode: 0o600 });
  assert.equal(readToken(file, false), 'sk-placeholder');
  assert.throws(() => readToken(file, true), /stub/);
  fs.chmodSync(file, 0o644);
  assert.throws(() => readToken(file, false), /chmod 600/);
  fs.writeFileSync(file, '\n', { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  assert.throws(() => readToken(file, false), /empty/);
});
