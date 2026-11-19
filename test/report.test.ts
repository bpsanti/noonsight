// noonsight report, driven as a separate process with an isolated home directory and a written log.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { NO_NETWORK, runCli, tempTree } from './helpers.js';

function writeLog(home: string, records: readonly Record<string, unknown>[], file = 'decisions.jsonl'): string {
  const dir = path.join(home, '.local', 'state', 'noonsight');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, file);
  fs.appendFileSync(target, records.map((r) => `${JSON.stringify(r)}\n`).join(''));
  return target;
}

const CONFIG = {
  version: 1,
  models: {
    'claude-sonnet-5-5': {
      use: 'custom',
      add: [
        { id: 'team/general', file: 'general.md' },
        { id: 'team/investigate', file: 'investigate.md', scopes: ['investigate'] },
        { id: 'team/review', file: 'review.md', scopes: ['review'], where: ['subagent'] },
      ],
    },
    'claude-haiku-5-5': { use: 'custom', add: [{ id: 'team/general', file: 'haiku.md' }] },
    'claude-opus-5-5': { use: 'none' },
  },
  scopes: { investigate: {}, review: {} },
};

function configTree(): string {
  return tempTree({
    'noonsight.json': CONFIG,
    'general.md': 'Say what you will do first.',
    'investigate.md': 'Name the evidence for each finding.',
    'review.md': 'Report only what you checked.',
    'haiku.md': 'Keep it short.',
  });
}

const LOG: Record<string, unknown>[] = [
  // Delivered by the session hook: two rules.
  { ts: '2026-11-14T10:00:00.000Z', event: 'session-start', session_id: 's1', model: 'claude-sonnet-5-5', status: 'matched', rules: ['team/general', 'team/investigate'], scope: 'investigate', place: 'unattended', delivered: 'rules' },
  // Delivered to a subagent, in a session already counted.
  { ts: '2026-11-14T10:05:00.000Z', event: 'agent-call', session_id: 's1', model: 'claude-sonnet-5-5', status: 'matched', rules: ['team/general'], scope: null, place: 'subagent', delivered: 'rules' },
  { ts: '2026-11-14T10:06:00.000Z', event: 'agent-result', session_id: 's1', result: 'match' },
  // Delivered by the launcher; the session start that follows finds them in the system prompt.
  { ts: '2026-11-15T09:00:00.000Z', event: 'launch', model: 'claude-haiku-5-5', status: 'matched', rules: ['team/general'], scope: null, place: 'session', delivered: 'system-prompt' },
  { ts: '2026-11-15T09:00:01.000Z', event: 'session-start', session_id: 's2', model: 'claude-haiku-5-5', status: 'matched', rules: ['team/general'], scope: null, place: 'session', delivered: 'launcher' },
  // A resumed session that already had them, and a switch that delivered rules with the note.
  { ts: '2026-11-15T10:00:00.000Z', event: 'session-start', session_id: 's1', model: 'claude-sonnet-5-5', status: 'matched', rules: ['team/general', 'team/investigate'], scope: 'investigate', place: 'unattended', delivered: 'already-delivered' },
  { ts: '2026-11-15T11:00:00.000Z', event: 'model-switch', session_id: 's3', model: 'claude-sonnet-5-5', from_model: 'claude-opus-5-5', status: 'matched', rules: ['team/general'], scope: null, place: 'session', delivered: 'rules+note' },
  // Nothing delivered, three ways.
  { ts: '2026-11-15T12:00:00.000Z', event: 'session-start', session_id: 's4', model: 'claude-opus-5-5', status: 'none', reason: 'declared-none', place: 'session', delivered: 'nothing' },
  { ts: '2026-11-16T08:00:00.000Z', event: 'session-start', session_id: 's5', model: 'claude-fable-5-2', status: 'undeclared', place: 'session', delivered: 'nothing' },
  { ts: '2026-11-16T08:30:00.000Z', event: 'agent-result', session_id: 's5', result: 'MISMATCH' },
  // A line older than scopes and places, and a torn line the reader skips.
  { ts: '2026-11-16T09:00:00.000Z', event: 'session-start', session_id: 's6', model: 'claude-sonnet-5-5', status: 'matched', rules: ['team/general'], delivered: 'rules' },
];

test('report counts each rule\'s deliveries by model, scope, place and event, and lists the rules on that were never delivered', () => {
  const home = tempTree({});
  const file = writeLog(home, LOG);
  fs.appendFileSync(file, '{"torn\n');
  const config = configTree();
  const r = runCli(['report'], { HOME: home, NOONSIGHT_CONFIG: path.join(config, 'noonsight.json') }, NO_NETWORK);
  assert.equal(r.status, 0, r.stderr);
  const state = path.join(home, '.local', 'state', 'noonsight');
  assert.equal(
    r.stdout,
    [
      `log ${path.join(state, 'decisions.1.jsonl')}, ${path.join(state, 'decisions.jsonl')}`,
      '11 decisions, from 2026-11-14T10:00:00.000Z to 2026-11-16T09:00:00.000Z',
      '  delivered rules: 5 (session-start 2, agent-call 1, launch 1, model-switch 1)',
      '  delivered no rules: 4 (already-delivered 1, declared-none 1, launcher 1, undeclared 1)',
      '  subagent checks: 2 (MISMATCH 1, match 1)',
      '',
      'Rules delivered, most often first:',
      '  team/general: 5 deliveries in 3 sessions, last 2026-11-16T09:00:00.000Z',
      '     models: claude-sonnet-5-5 4, claude-haiku-5-5 1',
      '     scopes: (none) 3, (not recorded) 1, investigate 1',
      '     places: session 2, (not recorded) 1, subagent 1, unattended 1',
      '     events: session-start 2, agent-call 1, launch 1, model-switch 1',
      '     text: 27 characters for claude-sonnet-5-5, 14 characters for claude-haiku-5-5',
      '  team/investigate: 1 delivery in 1 session, last 2026-11-14T10:00:00.000Z',
      '     models: claude-sonnet-5-5 1',
      '     scopes: investigate 1',
      '     places: unattended 1',
      '     events: session-start 1',
      '     text: 35 characters for claude-sonnet-5-5',
      '',
      `On in the configuration (${path.join(config, 'noonsight.json')}), never delivered in this log:`,
      '  team/review for claude-sonnet-5-5 (scopes: review; places: subagent)',
      '',
    ].join('\n'),
  );
  assert.doesNotMatch(r.stderr, /NETWORK-ATTEMPT/);
});

test('report --json prints the same as JSON', () => {
  const home = tempTree({});
  writeLog(home, LOG);
  const r = runCli(['report', '--json'], { HOME: home, NOONSIGHT_CONFIG: path.join(configTree(), 'noonsight.json') });
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(r.stdout) as Record<string, any>;
  assert.equal(report.decisions, LOG.length);
  assert.deepEqual(
    report.rules.map((x: Record<string, any>) => [x.id, x.deliveries]),
    [
      ['team/general', 5],
      ['team/investigate', 1],
    ],
  );
  assert.deepEqual(
    report.never_delivered.map((x: Record<string, any>) => [x.id, x.model]),
    [['team/review', 'claude-sonnet-5-5']],
  );
});

test('report reads the moved-away log before the current one, and --log reads one file instead', () => {
  const home = tempTree({});
  writeLog(home, [LOG[0] as Record<string, unknown>], 'decisions.1.jsonl');
  writeLog(home, [LOG[1] as Record<string, unknown>]);
  const both = JSON.parse(runCli(['report', '--json'], { HOME: home }).stdout) as Record<string, any>;
  assert.equal(both.decisions, 2);
  assert.equal(both.rules[0].deliveries, 2);

  const elsewhere = tempTree({ 'copied.jsonl': `${JSON.stringify(LOG[3])}\n` });
  const one = JSON.parse(runCli(['report', '--json', '--log', path.join(elsewhere, 'copied.jsonl')], { HOME: home }).stdout) as Record<string, any>;
  assert.deepEqual(one.log, [path.join(elsewhere, 'copied.jsonl')]);
  assert.deepEqual(one.delivering, { launch: 1 });
});

test('report without a configuration still reports the log, and says what it leaves out', () => {
  const home = tempTree({});
  writeLog(home, [LOG[0] as Record<string, unknown>]);
  const r = runCli(['report'], { HOME: home });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /team\/investigate: 1 delivery in 1 session/);
  assert.doesNotMatch(r.stdout, /text: /);
  assert.match(r.stdout, /No configuration at .*noonsight\.json, so rule lengths and the rules never delivered are not shown\./);

  const refused = tempTree({ 'noonsight.json': { version: 2 } });
  const r2 = runCli(['report'], { HOME: home, NOONSIGHT_CONFIG: path.join(refused, 'noonsight.json') });
  assert.equal(r2.status, 0, r2.stderr);
  assert.match(r2.stdout, /is refused \(`noonsight check` lists why\)/);
});

test('report counts a subagent\'s rules once, where its start delivered them, and the rules a shared start could not give', () => {
  const home = tempTree({});
  writeLog(home, [
    // The call hands its rules to the start; the start delivers them.
    { ts: '2026-11-17T10:00:00.000Z', event: 'agent-call', session_id: 's1', model: 'claude-sonnet-5-5', status: 'matched', rules: ['team/general'], scope: null, place: 'subagent', delivered: 'at-start' },
    { ts: '2026-11-17T10:00:01.000Z', event: 'subagent-start', session_id: 's1', start_match: 'single', model: 'claude-sonnet-5-5', status: 'matched', rules: ['team/general'], scope: null, place: 'subagent', delivered: 'rules' },
    // A call with no rules: counted at the call, not again at its start.
    { ts: '2026-11-17T10:01:00.000Z', event: 'agent-call', session_id: 's1', model: 'claude-opus-5-5', status: 'none', reason: 'declared-none', place: 'subagent', delivered: 'nothing' },
    { ts: '2026-11-17T10:01:01.000Z', event: 'subagent-start', session_id: 's1', start_match: 'single', model: 'claude-opus-5-5', status: 'none', place: 'subagent', delivered: 'nothing' },
    // Two calls with different rules whose starts could not be told apart.
    { ts: '2026-11-17T10:02:01.000Z', event: 'subagent-start', session_id: 's1', start_match: 'shared', model: null, place: 'subagent', reason: 'calls-differ', delivered: 'nothing' },
  ]);
  const report = JSON.parse(runCli(['report', '--json'], { HOME: home }).stdout) as Record<string, any>;
  assert.deepEqual(report.delivering, { 'subagent-start': 1 });
  assert.deepEqual(report.not_delivering, { 'calls-differ': 1, 'declared-none': 1 });
  assert.deepEqual(
    report.rules.map((x: Record<string, any>) => [x.id, x.deliveries, x.events]),
    [['team/general', 1, { 'subagent-start': 1 }]],
  );
});

test('report does not count as delivered a switch the session\'s next line switches again from', () => {
  const home = tempTree({});
  const line = (n: number, session: string, fields: Record<string, unknown>) => ({ ts: `2026-11-17T12:00:0${n}.000Z`, session_id: session, ...fields });
  const toSonnet = { event: 'model-switch', model: 'claude-sonnet-5-5', status: 'matched', rules: ['team/general'], place: 'session', delivered: 'rules+note' };
  const toHaiku = { ...toSonnet, model: 'claude-haiku-5-5', delivered: 'rules' };
  writeLog(home, [
    // Two switches in a row: the first one's return may never have reached a request.
    line(0, 's1', toSonnet),
    // Another session's line in between does not count.
    line(1, 's2', { event: 'session-start', model: 'claude-opus-5-5', status: 'none', reason: 'declared-none', delivered: 'nothing' }),
    line(2, 's1', toHaiku),
    // A switch with a decision of its session after it, before the next switch: counted.
    line(3, 's1', { event: 'agent-call', model: 'claude-haiku-5-5', status: 'none', reason: 'no-rule-applies', place: 'subagent', delivered: 'nothing' }),
    line(4, 's1', toSonnet),
    // The session's last switch: counted.
    // A switch that delivered no rules keeps its own reason when another switch follows it.
    line(5, 's3', { event: 'model-switch', model: 'claude-fable-5-2', status: 'undeclared', place: 'session', delivered: 'note' }),
    line(6, 's3', toSonnet),
  ]);
  const report = JSON.parse(runCli(['report', '--json'], { HOME: home }).stdout) as Record<string, any>;
  assert.deepEqual(report.delivering, { 'model-switch': 3 });
  assert.deepEqual(report.not_delivering, { 'declared-none': 1, 'no-rule-applies': 1, 'switched-again': 1, undeclared: 1 });
  assert.deepEqual(
    report.rules.map((x: Record<string, any>) => [x.id, x.deliveries, x.models]),
    [['team/general', 3, { 'claude-haiku-5-5': 1, 'claude-sonnet-5-5': 2 }]],
  );
});

test('report summarizes the classifier: tasks by result, the median and longest run, and the total cost', () => {
  const home = tempTree({});
  const at = (n: number): string => `2026-11-17T11:00:0${n}.000Z`;
  writeLog(home, [
    { ts: at(0), event: 'agent-call', classifier: 'scoped', classifier_ms: 2100, classifier_cost_usd: 0.0004, delivered: 'nothing', status: 'none' },
    { ts: at(1), event: 'agent-call', classifier: 'scoped', classifier_ms: 1500, classifier_cost_usd: 0.0003, delivered: 'nothing', status: 'none' },
    { ts: at(2), event: 'agent-call', classifier: 'timeout', classifier_ms: 8000, classifier_error: 'stopped after 8000 ms', delivered: 'nothing', status: 'none' },
    { ts: at(3), event: 'launch', classifier: 'none', classifier_ms: 1700, classifier_cost_usd: 0.0002, delivered: 'nothing', status: 'none' },
    // Not run: the scope could change nothing, or a launch had no task text.
    { ts: at(4), event: 'agent-call', classifier: 'not-needed', delivered: 'nothing', status: 'none' },
    { ts: at(5), event: 'launch', classifier: 'no-task', delivered: 'nothing', status: 'none' },
    { ts: at(6), event: 'agent-call', delivered: 'nothing', status: 'none' },
  ]);
  const r = runCli(['report'], { HOME: home });
  assert.equal(r.status, 0, r.stderr);
  assert.match(
    r.stdout,
    /\nClassifier:\n {2}tasks: 6 \(scoped 2, no-task 1, none 1, not-needed 1, timeout 1\)\n {2}runs: 4, median 1900 ms, longest 8000 ms, cost US\$ 0\.0009\n/,
  );
  const report = JSON.parse(runCli(['report', '--json'], { HOME: home }).stdout) as Record<string, any>;
  assert.deepEqual(report.classifier, {
    results: { scoped: 2, 'no-task': 1, none: 1, 'not-needed': 1, timeout: 1 },
    runs: 4,
    median_ms: 1900,
    max_ms: 8000,
    cost_usd: 0.0009,
  });

  // A log in which the classifier never acted has no classifier section.
  const quiet = tempTree({});
  writeLog(quiet, [LOG[0] as Record<string, unknown>]);
  assert.doesNotMatch(runCli(['report'], { HOME: quiet }).stdout, /Classifier/);
  assert.equal((JSON.parse(runCli(['report', '--json'], { HOME: quiet }).stdout) as Record<string, any>).classifier, null);
});

test('report with an empty log says so', () => {
  const r = runCli(['report'], {});
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^log .*\nNo decisions in the log\.\n/);
});

test('report refuses an unknown option, a stray argument and a --log it cannot read', () => {
  const dir = tempTree({});
  for (const [args, message] of [
    [['report', '--all'], /unknown option --all/],
    [['report', 'today'], /unexpected argument "today"/],
    [['report', '--log'], /--log needs a value/],
    [['report', '--log', path.join(dir, 'missing.jsonl')], /cannot read the log file .*missing\.jsonl/],
    [['report', '--log', dir], /cannot read the log file/],
  ] as const) {
    const r = runCli([...args], {});
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.stderr, message);
    assert.match(r.stderr, /usage: noonsight report/);
  }
  const help = runCli(['report', '--help'], {});
  assert.equal(help.status, 0);
  assert.match(help.stdout, /^usage: noonsight report/);
});
