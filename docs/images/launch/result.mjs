// The one result the launch assets show, R10 of docs/evidence.md, computed from its committed raw run.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, '../../../experiments/rules/results/2026-11-20-harder');
const RULE = 'sonnet-5-5/carry-through';

export const RUNS = fs.readFileSync(path.join(DIR, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  .filter((r) => r.model === 'sonnet' && r.task === 'triage');

function arm(name, rules) {
  const runs = RUNS.filter((r) => r.arm === name);
  if (!runs.every((r) => r.noonsight.rules.join() === rules)) throw new Error(`the arm ${name} received other rules`);
  if (!runs.every((r) => r.signals.completed === r.signals.check_passed)) throw new Error('every part done and the hidden check differ');
  return `${runs.filter((r) => r.signals.completed).length} of ${runs.length}`;
}
export const WITH = arm('carry', RULE);
export const WITHOUT = arm('none', '');
export const VERSION = [...new Set(RUNS.map((r) => r.claude_code))].join();
export const EFFORT = [...new Set(RUNS.map((r) => r.effort))].join();
export const PLACE = [...new Set(RUNS.map((r) => r.noonsight.place))].join();
export const DATE = '2026-11-20';

/** The lines of the rule, as `noonsight report` printed them in the run's summary.md. */
const summary = fs.readFileSync(path.join(DIR, 'summary.md'), 'utf8').split('\n');
const at = summary.findIndex((l) => l.startsWith(`  ${RULE}: `));
if (at < 0) throw new Error('summary.md has no report lines for the rule');
export const REPORT = summary.slice(at, at + 4).map((l) => l.slice(2));

export const HEADLINE = 'Write your own rules, per model.';
export const SUBHEAD = 'noonsight delivers each rule to the model it is written for.';
export const INSTALL = 'npm install -g noonsight && noonsight install';
export const REPO = 'github.com/bpsanti/noonsight';
export const NOTE = 'Almost all of the difference is one ticket that leaves a decision open. A rule of your own has no measured effect until you measure it.';
