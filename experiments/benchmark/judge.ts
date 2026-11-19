// The judge of the open tasks: Claude Opus 5.5 at high effort, three votes, majority per rubric item.
// It is the same family as the models under test, a limitation the pre-registration declares; the
// author grades about 15 answers blind to calibrate it (calibration.ts).
//
// The judge sees the task, the answer and the rubric, never the condition: the answer is scrubbed
// of noonsight's strings first. Each vote is one `claude -p` call from the given account's login,
// with Claude Code's system prompt replaced by the judge's, no tools, and none of the person's
// settings, hooks or MCP servers.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Plan } from './plan.js';
import { accountEnv } from './quota.js';
import type { SetName } from './tasks.js';

/** One rubric item: a statement the answer meets or does not. */
export interface Item {
  readonly id: string;
  readonly statement: string;
  /** Items that count toward the score; SWE Atlas scores its "must have" items. */
  readonly scored: boolean;
}

export interface Rubric {
  readonly system: string;
  /** The task as the agent saw it. */
  readonly prompt: string;
  readonly items: readonly Item[];
}

export interface Grade {
  readonly key: string;
  readonly set: SetName;
  readonly score: number | null;
  readonly items: readonly { readonly id: string; readonly yes: number; readonly no: number; readonly verdict: boolean | null }[];
  readonly votes: number;
  readonly cost_usd: number;
  readonly error: string | null;
}

const SCRUB = /noonsight[-\w]*|(\/opt\/)?agent-notes[-\w/.]*|(fable|opus|sonnet|haiku)-5-[25]\/[\w-]+|local\/[\w-]+/gi;

/** The answer as the judge sees it: without any string that could reveal the condition. */
export function scrub(answer: string): string {
  return answer.replace(SCRUB, '[removed]');
}

/** SWE Atlas: the task's own rubric and judge prompts; its "must have" items are scored. */
export function sweAtlasRubric(grading: string, instruction: string): Rubric {
  const raw = JSON.parse(fs.readFileSync(path.join(grading, 'rubrics.json'), 'utf8')) as { id: string; title: string; annotations?: { importance?: string } }[];
  return {
    system: fs.readFileSync(path.join(grading, 'system_prompt.txt'), 'utf8'),
    prompt: instruction,
    items: raw.map((r) => ({ id: r.id, statement: r.title, scored: (r.annotations?.importance ?? '').toLowerCase() === 'must have' })),
  };
}

const MATCH_SYSTEM = `You grade a code review against reference findings that human reviewers confirmed for the same pull request. For each rubric statement, answer YES only when the review contains a finding that identifies the same underlying problem in the same place (same file, overlapping or adjacent lines, or the same function), even if worded differently. A finding that only mentions the same file or a different problem does not count. Return a JSON object {"ratings": [{"rubric_statement": ..., "justification": ..., "status": "YES" or "NO", "score": "1" or "0"}]} with one rating per statement, in the order given.`;

/** ReviewBench: one item per golden finding, met when the review reports it (grounded recall). */
export function reviewRubric(grading: string, instruction: string): Rubric {
  const goldenDir = path.join(grading, 'golden');
  const file = fs.readdirSync(goldenDir).find((f) => f.endsWith('.json'));
  if (!file) throw new Error(`no golden findings in ${goldenDir}`);
  const golden = JSON.parse(fs.readFileSync(path.join(goldenDir, file), 'utf8')) as { findings: { file: string; start_line: number; end_line: number; message: string }[] };
  return {
    system: MATCH_SYSTEM,
    prompt: instruction,
    items: golden.findings.map((g, i) => ({ id: `golden-${i + 1}`, statement: `The review reports this problem: ${g.file} lines ${g.start_line}-${g.end_line}: ${g.message}`, scored: true })),
  };
}

const DIGEST_SYSTEM = `You grade a summary of a software issue and its discussion against key points written in advance by a maintainer who read the whole thread. For each rubric statement, answer YES only when the summary states that point accurately; a point the summary contradicts, or states only in part, is NO. Return a JSON object {"ratings": [{"rubric_statement": ..., "justification": ..., "status": "YES" or "NO", "score": "1" or "0"}]} with one rating per statement, in the order given.`;

/** A digest: the key points the author wrote from the thread before any run (rubrics/digest/<id>.json). */
export function digestRubric(file: string, instruction: string): Rubric {
  const r = JSON.parse(fs.readFileSync(file, 'utf8')) as { key_points: string[] };
  if (!Array.isArray(r.key_points) || r.key_points.length < 5) throw new Error(`${file} needs the author's 5 to 8 key points before any digest is graded`);
  return { system: DIGEST_SYSTEM, prompt: instruction, items: r.key_points.map((k, i) => ({ id: `point-${i + 1}`, statement: k, scored: true })) };
}

/** The user message of one vote, in SWE Atlas's layout: the prompt, the response, then every criterion. */
export function judgeMessage(rubric: Rubric, answer: string): string {
  const criteria = rubric.items.map((i) => ({ id: i.id, rubric_statement: i.statement }));
  return `# Prompt\n${rubric.prompt}\n\n# Response\n${scrub(answer)}\n\n# Rubric Criteria\n${JSON.stringify(criteria, null, 2)}\n`;
}

/** The ratings of one vote, matched to the items by order and statement. */
export function parseRatings(text: string, items: readonly Item[]): (boolean | null)[] {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return items.map(() => null);
  let ratings: { rubric_statement?: string; status?: string; score?: string | number }[] = [];
  try {
    ratings = (JSON.parse(text.slice(start, end + 1)) as { ratings?: typeof ratings }).ratings ?? [];
  } catch {
    return items.map(() => null);
  }
  return items.map((item, i) => {
    const r = ratings.find((x) => x.rubric_statement === item.statement) ?? ratings[i];
    if (!r) return null;
    const s = String(r.score ?? '').trim();
    const status = String(r.status ?? '').toUpperCase();
    return s === '1' || status === 'YES' ? true : s === '0' || status === 'NO' ? false : null;
  });
}

/** The verdict of each item over the votes, and the score: the share of scored items met. */
export function tally(items: readonly Item[], votes: readonly (boolean | null)[][]): Pick<Grade, 'items' | 'score'> {
  const out = items.map((item, i) => {
    const yes = votes.filter((v) => v[i] === true).length;
    const no = votes.filter((v) => v[i] === false).length;
    return { id: item.id, yes, no, verdict: yes > no ? true : no > yes ? false : null };
  });
  const scored = out.filter((o, i) => items[i]?.scored);
  const decided = scored.filter((o) => o.verdict !== null);
  return { items: out, score: decided.length === scored.length && scored.length > 0 ? decided.filter((o) => o.verdict).length / scored.length : null };
}

/** What Claude Code needs from the environment to find the account's login, and nothing else: on macOS the login is in the keychain, found through USER. */
export function loginEnv(): Record<string, string> {
  const env: Record<string, string> = { HOME: os.homedir() };
  for (const name of ['PATH', 'USER', 'LOGNAME', 'TMPDIR', 'SHELL']) {
    const value = process.env[name];
    if (value) env[name] = value;
  }
  return env;
}

/** One vote: a `claude -p` call with the judge's system prompt and no tools. */
function vote(plan: Plan, account: string, rubric: Rubric, answer: string): { text: string; cost: number; error: string | null } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-judge-'));
  try {
    const r = spawnSync(
      'claude',
      [
        '-p', judgeMessage(rubric, answer),
        '--output-format', 'json',
        '--model', plan.judge.model, '--effort', plan.judge.effort, '--max-budget-usd', String(plan.judge.budget_usd / plan.judge.votes),
        '--system-prompt', rubric.system,
        '--tools', '', '--setting-sources', 'project,local', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence',
      ],
      { cwd: dir, encoding: 'utf8', timeout: 600_000, maxBuffer: 64 * 2 ** 20, env: { ...accountEnv(account, loginEnv()), NOONSIGHT_DISABLE: '1', DISABLE_AUTOUPDATER: '1' } },
    );
    const out = JSON.parse(r.stdout || '{}') as { result?: string; total_cost_usd?: number; is_error?: boolean; subtype?: string };
    return { text: String(out.result ?? ''), cost: Number(out.total_cost_usd ?? 0), error: r.status === 0 && !out.is_error ? null : `judge exited ${r.status} (${out.subtype ?? 'no result'})` };
  } catch (e) {
    return { text: '', cost: 0, error: (e as Error).message };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Grade one answer: the plan's number of votes, majority per item. */
export function grade(plan: Plan, account: string, key: string, set: SetName, rubric: Rubric, answer: string): Grade {
  const votes: (boolean | null)[][] = [];
  let cost = 0;
  let error: string | null = null;
  for (let i = 0; i < plan.judge.votes; i++) {
    const v = vote(plan, account, rubric, answer);
    cost += v.cost;
    if (v.error) error = v.error;
    votes.push(parseRatings(v.text, rubric.items));
  }
  return { key, set, ...tally(rubric.items, votes), votes: votes.length, cost_usd: Math.round(cost * 10000) / 10000, error };
}
