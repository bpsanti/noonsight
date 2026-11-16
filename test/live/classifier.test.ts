// Live classifier tests, run from the login of the person running them. They send prompts to the
// models, so they spend a little usage, and they only run when asked:
//
//   SEXTANT_LIVE_LOGIN=1 npm run test:live
//
// classifier-agreement asks the classifier, as sextant runs it, to place each hand-labeled task in
// test/fixtures/classifier/tasks.json with the scopes of the claude preset, and reports how often it
// agrees with the label; the README reports the result. The other two run real sessions that start a
// subagent, with sextant's hooks given through --settings: one whose task the classifier places, and
// one whose classification is stopped by the time limit. login.ts describes what they need, and what
// they touch in the person's Claude Code directory.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { classify } from '../../src/adapters/claude-code/classifier.js';
import { loadConfig } from '../../src/config/load.js';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import { baseEnv, calls, enabled, lab, preconditions, print, type Lab } from './login.js';

const TASKS = path.join(PACKAGE_ROOT, 'test', 'fixtures', 'classifier', 'tasks.json');

/** The share of tasks below which the agreement test fails: a floor that catches a broken question, not a target. */
const AGREEMENT_FLOOR = 0.75;

test('live, login: classifier-agreement: the classifier places the hand-labeled tasks with the preset\'s scopes', { skip: !enabled }, (t) => {
  preconditions();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-live-agreement-'));
  const file = path.join(dir, 'sextant.json');
  fs.writeFileSync(file, JSON.stringify({ version: 1, preset: 'claude', classifier: { mode: 'fallback' } }));
  const config = loadConfig(file, {}, {});
  const c = config.classifier;
  const tasks = JSON.parse(fs.readFileSync(TASKS, 'utf8')) as { label: string; text: string }[];
  assert.ok(tasks.length >= 40);

  const rows = tasks.map((task) => {
    const r = classify(config, task.text, baseEnv());
    const got = r.result === 'scoped' ? r.scope : r.result === 'none' ? 'none' : `(${r.result})`;
    return { ...task, got, ms: r.ms, ...('error' in r ? { error: r.error } : {}) };
  });
  const agreed = rows.filter((r) => r.got === r.label).length;
  const failed = rows.filter((r) => r.got.startsWith('('));
  const labels = [...new Set(tasks.map((x) => x.label))];
  const report = [
    `classifier ${c.model} at ${c.effort} effort, preset ${config.scopes.size} scopes: agreed on ${agreed} of ${rows.length} tasks (${Math.round((100 * agreed) / rows.length)}%)`,
    ...labels.map((label) => {
      const of = rows.filter((r) => r.label === label);
      return `  ${label}: ${of.filter((r) => r.got === label).length} of ${of.length}`;
    }),
    'disagreements:',
    ...rows.filter((r) => r.got !== r.label).map((r) => `  ${r.label} -> ${r.got}: ${r.text}${r.error ? ` (${r.error})` : ''}`),
    `slowest: ${Math.max(...rows.map((r) => r.ms))} ms`,
  ];
  for (const line of report) t.diagnostic(line);
  fs.writeFileSync(path.join(dir, 'agreement.json'), JSON.stringify(rows, null, 2));
  t.diagnostic(`every answer: ${path.join(dir, 'agreement.json')}`);
  assert.deepEqual(failed, [], 'every classification answered');
  assert.ok(agreed / rows.length >= AGREEMENT_FLOOR, report.join('\n'));
});

const ALL_WORD = 'ALL-SCOPES-LIVE-5810';
const DIGEST_WORD = 'DIGEST-LIVE-3926';

/** Sonnet has one rule for every scope and one for the preset's digest scope; the classifier is on. */
function classifierLab(name: string, classifier: Record<string, unknown>): Lab {
  return lab(
    name,
    {
      version: 1,
      preset: 'claude',
      models: {
        'claude-sonnet-5-5': {
          use: 'custom',
          add: [
            { id: 'live/all', file: 'all.md' },
            { id: 'live/digest', file: 'digest.md', scopes: ['digest'] },
          ],
        },
      },
      classifier,
    },
    {
      'all.md': `- The verification word for claude-sonnet-5-5 in every scope is ${ALL_WORD}.`,
      'digest.md': `- The verification word for claude-sonnet-5-5 in the digest scope is ${DIGEST_WORD}.`,
    },
  );
}

const SUBAGENT_TASK =
  'This is a configuration test. Make exactly one Agent tool call with subagent_type "general-purpose", the model parameter "sonnet", ' +
  'the description "Condense a paragraph", and exactly this prompt: ' +
  '"Summarize the following paragraph in one sentence: The quarterly report shows that revenue grew by eight percent while costs stayed flat, ' +
  'and that the new pricing page drove most of the growth. After the summary, on a new line, write the verification words of any sextant working rules ' +
  'you were given in this conversation, separated by single spaces, or the single word NONE if you were given none. Do not use any tool." ' +
  'After the result arrives, reply with the subagent\'s reply verbatim.';

test('live, login: classifier-subagent: the classifier places a subagent\'s task, the rules of that scope reach it, and no hook runs in the classifier\'s session', { skip: !enabled }, () => {
  preconditions();
  const l = classifierLab('classify', { mode: 'fallback' });
  const r = print(l, SUBAGENT_TASK);
  assert.equal(r.status, 0, r.result);
  assert.match(r.result, new RegExp(ALL_WORD), r.result);
  assert.match(r.result, new RegExp(DIGEST_WORD), r.result);
  const [call, ...more] = calls(l.log());
  assert.deepEqual(more, []);
  assert.deepEqual(
    [call?.model, call?.scope, call?.scope_source, call?.classifier, call?.rules, call?.delivered],
    ['claude-sonnet-5-5', 'digest', 'classifier', 'scoped', ['live/all', 'live/digest'], 'rules'],
  );
  // Every line comes from the lab's session: none from the classifier's.
  assert.deepEqual(
    l.log().map((d) => d.event),
    ['session-start', 'agent-call', 'agent-result'],
  );
  assert.equal(new Set(l.log().map((d) => d.session_id)).size, 1);
});

test('live, login: classifier-timeout: a classification stopped by the time limit leaves the subagent with no scope, and the log says so', { skip: !enabled }, () => {
  preconditions();
  const l = classifierLab('classify-timeout', { mode: 'fallback', timeout_ms: 1000 });
  const r = print(l, SUBAGENT_TASK);
  assert.equal(r.status, 0, r.result);
  assert.match(r.result, new RegExp(ALL_WORD), r.result);
  assert.doesNotMatch(r.result, new RegExp(DIGEST_WORD), r.result);
  const [call] = calls(l.log());
  assert.deepEqual(
    [call?.scope, call?.scope_source, call?.classifier, call?.classifier_error, call?.rules, call?.warned],
    [null, null, 'timeout', 'no answer within 1000 ms', ['live/all'], true],
  );
});
