// The scoring and the summary of the rule effect experiment (experiments/rules), on recorded and
// written inputs: no model is asked anything here.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { cellKey, cells, EXPERIMENT_DIR, loadPlan, type RunRecord } from '../experiments/rules/run.js';
import { answerLine, answerScore, changedFiles, handsBack, prose, toolCalls, verification } from '../experiments/rules/score.js';
import { summarize } from '../experiments/rules/summary.js';
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
    if (task.check) assert.ok(fs.existsSync(path.join(EXPERIMENT_DIR, task.check)), task.check);
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
    /\| fix \| sonnet \| Runs that ran the tests after their last edit, of those that edited code \| 2 of 2 \| 0 of 2 \|/,
  );
  assert.match(text, /\| fix \| sonnet \| Runs that changed files beyond the ones asked \| 0 of 2 \| 1 of 2 \|/);
  assert.match(text, /\| fix \| sonnet \| Output tokens per run \| 1,300 \(1,200 to 1,400\) \| 900 \(800 to 1,000\) \|/);
  assert.match(text, /\| fix \| sonnet \| Difference of the means \| \+400 output, \+0 input tokens \| \+\$0\.020 per run \|/);
  assert.match(text, /\| fix \| sonnet \| Delivered in the same runs \| sonnet-5-5\/stay-in-scope \|/);
  assert.match(text, /### `opus-5-5\/unattended-run`\n\nNot delivered in any run of this experiment, so not measured\./);
});
