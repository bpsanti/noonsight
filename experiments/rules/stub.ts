// A scripted stand-in for the model, so the whole experiment runs end to end without sending
// anything to Anthropic or spending a token: `npm run experiment -- run --stub`. Claude Code, the
// lab, noonsight's hooks, the hidden checks, the scoring and the summary are the real ones; only the
// answers to the Messages requests come from this script, through the delivery benchmark's local API
// (../delivery/stub.ts).
//
// The script plays the task's reference solution (solutions/<task>): it reads the files the solution
// touches that the fixture already has, writes the solution's files, runs `npm test` when the session
// received a verify-changes rule and the task changes code, and ends with a short report; given the
// verify rule as a pointer to its text, it reads that file first. So a stub
// run exercises every path a real run takes, and the summary must show the difference the script
// builds in: tests after the last edit only with a verify rule, and a denser report without any rule.
// Its numbers say nothing about any model.

import fs from 'node:fs';
import path from 'node:path';
import type { Answer, Body } from '../delivery/stub.js';
import type { Task } from './run.js';

/** How noonsight's SessionStart hook marks the rules it delivers; a request with it comes from a session that received rules. */
export const RULES_MARKER = '<noonsight-rules';

/** The rule ids noonsight's envelopes name in a request, in the order they appear (src/core/resolve.ts, envelope). */
export function deliveredRules(body: Body): string[] {
  const text = JSON.stringify([body.system ?? '', body.messages ?? []]);
  if (!text.includes(RULES_MARKER)) return [];
  const ids = [...text.matchAll(/\(delivered by noonsight, rules ([^)]*)\)/g)].flatMap((m) => (m[1] ?? '').split(', '));
  return [...new Set(ids.filter(Boolean))];
}

/** Whether the rules delivered include a verify rule, the one whose source claims the tests, inline or as a pointer to its text. */
const verifies = (rules: readonly string[]): boolean => rules.some((id) => id.endsWith('/verify-changes') || id.endsWith('/verify-changes-pointer'));

/** Whether the rules delivered include a pointer rule, which says to read the file holding a rule's text. */
const points = (rules: readonly string[]): boolean => rules.some((id) => id.endsWith('-pointer'));

/** The reports the script ends with: plain short sentences with any rule, one dense sentence without. */
export const STUB_REPORTS = {
  rules: 'I changed the files the task names. The project tests pass after the change.',
  none: 'I changed the files the task names (and nothing else); the change follows the existing code; I did not run anything after it.',
} as const;

/** The files of a reference solution, relative path to content. */
export function solutionFiles(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[path.relative(dir, full).split(path.sep).join('/')] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(dir);
  return out;
}

interface Step {
  readonly calls?: readonly { readonly name: string; readonly input: Record<string, unknown> }[];
  readonly text?: string;
}

/**
 * The script of one run: what the stand-in does at each turn of the session's own conversation. With
 * a pointer rule delivered, it first reads `ruleFile`, the file the pointer names.
 */
export function script(task: Task, solution: Record<string, string>, fixture: string, project: string, rules: readonly string[], ruleFile: string | null = null): Step[] {
  const files = Object.keys(solution).sort();
  const existing = files.filter((f) => fs.existsSync(path.join(fixture, f)));
  const changesCode = task.check !== undefined;
  const steps: Step[] = [];
  if (ruleFile && points(rules)) steps.push({ calls: [{ name: 'Read', input: { file_path: ruleFile } }] });
  if (existing.length) steps.push({ calls: existing.map((f) => ({ name: 'Read', input: { file_path: path.join(project, f) } })) });
  steps.push({ calls: files.map((f) => ({ name: 'Write', input: { file_path: path.join(project, f), content: solution[f] } })) });
  if (verifies(rules) && changesCode) steps.push({ calls: [{ name: 'Bash', input: { command: 'npm test', description: 'Run the tests' } }] });
  steps.push({ text: task.report ? `The report is in ${task.report}.` : rules.length ? STUB_REPORTS.rules : STUB_REPORTS.none });
  return steps;
}

let ids = 0;

/**
 * The answer to one Messages request. A request without tools, such as a title, gets a short text.
 * The session's own conversation is answered by the script, one step per assistant message already
 * in it; past the script's end, a short text ends the turn.
 */
export function stubReply(body: Body, steps: (rules: readonly string[]) => readonly Step[]): Answer {
  const messages = (body.messages ?? []) as Body[];
  const text = (t: string): Answer => ({ content: [{ type: 'text', text: t }], stop: 'end_turn', usage: usage(body, t) });
  if (!Array.isArray(body.tools) || body.tools.length === 0) return text('ok');
  const step = steps(deliveredRules(body))[messages.filter((m) => m.role === 'assistant').length];
  if (!step) return text('Done.');
  if (step.text !== undefined) return text(step.text);
  const content = (step.calls ?? []).map((c) => ({ type: 'tool_use', id: `toolu_rx_${process.pid.toString(36)}_${(ids++).toString(36)}`, name: c.name, input: c.input }));
  return { content, stop: 'tool_use', usage: usage(body, JSON.stringify(content)) };
}

/** Usage at about four characters a token, so Claude Code reports a cost of the size a real session's context would have, uncached. */
function usage(body: Body, reply: string): { input_tokens: number; output_tokens: number } {
  return { input_tokens: Math.ceil(JSON.stringify(body).length / 4), output_tokens: Math.ceil(reply.length / 4) };
}
