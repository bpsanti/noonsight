// sextant report, driven as a separate process with an isolated home directory and a written log.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { NO_NETWORK, runCli, tempTree } from './helpers.js';

function writeLog(home: string, records: readonly Record<string, unknown>[], file = 'decisions.jsonl'): string {
  const dir = path.join(home, '.local', 'state', 'sextant');
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
    'sextant.json': CONFIG,
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
  const r = runCli(['report'], { HOME: home, SEXTANT_CONFIG: path.join(config, 'sextant.json') }, NO_NETWORK);
  assert.equal(r.status, 0, r.stderr);
  const state = path.join(home, '.local', 'state', 'sextant');
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
      `On in the configuration (${path.join(config, 'sextant.json')}), never delivered in this log:`,
      '  team/review for claude-sonnet-5-5 (scopes: review; places: subagent)',
      '',
    ].join('\n'),
  );
  assert.doesNotMatch(r.stderr, /NETWORK-ATTEMPT/);
});

test('report --since keeps the decisions from that date on, and --json prints the same as JSON', () => {
  const home = tempTree({});
  writeLog(home, LOG);
  const r = runCli(['report', '--since', '2026-11-15', '--json'], { HOME: home, SEXTANT_CONFIG: path.join(configTree(), 'sextant.json') });
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(r.stdout) as Record<string, any>;
  assert.equal(report.since, '2026-11-15T00:00:00.000Z');
  assert.equal(report.decisions, 8);
  assert.deepEqual(report.delivering, { launch: 1, 'model-switch': 1, 'session-start': 1 });
  assert.deepEqual(
    report.rules.map((x: Record<string, any>) => [x.id, x.deliveries, x.models]),
    [['team/general', 3, { 'claude-haiku-5-5': 1, 'claude-sonnet-5-5': 2 }]],
  );
  assert.deepEqual(
    report.never_delivered.map((x: Record<string, any>) => [x.id, x.model]),
    [
      ['team/investigate', 'claude-sonnet-5-5'],
      ['team/review', 'claude-sonnet-5-5'],
    ],
  );

  const time = runCli(['report', '--since', '2026-11-16T08:15:00Z', '--json'], { HOME: home });
  assert.equal(JSON.parse(time.stdout).decisions, 2);
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
  assert.match(r.stdout, /No configuration at .*sextant\.json, so rule lengths and the rules never delivered are not shown\./);

  const refused = tempTree({ 'sextant.json': { version: 2 } });
  const r2 = runCli(['report'], { HOME: home, SEXTANT_CONFIG: path.join(refused, 'sextant.json') });
  assert.equal(r2.status, 0, r2.stderr);
  assert.match(r2.stdout, /is refused \(`sextant check` lists why\)/);
});

test('report with an empty log says so', () => {
  const r = runCli(['report'], {});
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^log .*\nNo decisions in the log\.\n/);
});

test('report refuses an unknown option, a stray argument and a --since it cannot read', () => {
  for (const [args, message] of [
    [['report', '--all'], /unknown option --all/],
    [['report', 'today'], /unexpected argument "today"/],
    [['report', '--since'], /--since needs a value/],
    [['report', '--since', 'yesterday'], /--since takes a date \(YYYY-MM-DD\) or an ISO 8601 time, not "yesterday"/],
    [['report', '--log'], /--log needs a value/],
  ] as const) {
    const r = runCli([...args], {});
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.stderr, message);
    assert.match(r.stderr, /usage: sextant report/);
  }
  const help = runCli(['report', '--help'], {});
  assert.equal(help.status, 0);
  assert.match(help.stdout, /^usage: sextant report/);
});
