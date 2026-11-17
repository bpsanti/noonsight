// Delivery, measured on the requests Claude Code sends: for each path a rule can take (the session's
// start, a model switch, compaction, /clear, each kind of subagent), whether the rules written for the
// model of the request are in it, and whose other rules came along. The requests come from a local
// stand-in for the API (test/live/stub-api.ts), so the measure costs no tokens and repeats exactly.

import { defaultOnRules, presetText } from './conditions.js';

/** The rule texts that belong to one model only: a text two models share cannot say whose rule arrived. */
export function signatures(models: readonly string[]): Map<string, string[]> {
  const owners = new Map<string, Set<string>>();
  for (const m of models) for (const r of defaultOnRules(m)) owners.set(presetText(r).trim(), (owners.get(presetText(r).trim()) ?? new Set()).add(m));
  const out = new Map<string, string[]>(models.map((m) => [m, []]));
  for (const [textOf, who] of owners) if (who.size === 1) out.get([...who][0] as string)?.push(JSON.stringify(textOf.slice(0, 120)).slice(1, -1));
  return out;
}

/** The models whose rules a request carries, anywhere in it. */
export function rulesIn(body: Record<string, unknown>, sigs: ReadonlyMap<string, readonly string[]>): string[] {
  const raw = JSON.stringify(body);
  return [...sigs].filter(([, s]) => s.some((x) => raw.includes(x))).map(([m]) => m);
}

function userText(message: Record<string, any> | undefined): string {
  if (!message) return '';
  const content = typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : ((message.content ?? []) as Record<string, any>[]);
  return content
    .filter((b) => b.type === 'text')
    .map((b) => String(b.text))
    .join('\n');
}

/**
 * The path a request stands for: `subagent <type>` for a subagent's turn, the step's name for the
 * session's turn that a "PROBE-STEP <name>" prompt starts, or null for the rest (tool results,
 * compaction's own summary, Claude Code's side requests).
 */
export function pathOf(body: Record<string, any>): string | null {
  const users = ((body.messages ?? []) as Record<string, any>[]).filter((m) => m.role === 'user');
  const sub = /PROBE-SUBAGENT-TASK ([\w-]+)/.exec(userText(users[0]));
  if (sub) return `subagent ${sub[1]}`;
  const last = users.at(-1);
  const content = typeof last?.content === 'string' ? [] : ((last?.content ?? []) as Record<string, any>[]);
  if (content.some((b) => b.type === 'tool_result')) return null;
  const step = /PROBE-STEP ([\w-]+)/.exec(userText(last));
  return step && !(step[1] ?? '').startsWith('spawn') ? (step[1] as string) : null;
}

export interface Delivery {
  readonly path: string;
  readonly model: string;
  /** The rules written for the request's model are in the request. */
  readonly own: boolean;
  /** Other models whose rules are in the request. */
  readonly others: readonly string[];
}

/** One row per path, from the first request of each path. */
export function deliveries(requests: readonly { body: Record<string, any> }[], models: readonly string[]): Delivery[] {
  const sigs = signatures(models);
  const rows = new Map<string, Delivery>();
  for (const { body } of requests) {
    const p = pathOf(body);
    if (p === null || rows.has(p)) continue;
    const model = String(body.model ?? '');
    const present = rulesIn(body, sigs);
    rows.set(p, { path: p, model, own: present.includes(model), others: present.filter((m) => m !== model) });
  }
  return [...rows.values()];
}

/** The table of the delivery probe: one row per path, one column per arm. */
export function deliveryTable(arms: Readonly<Record<string, readonly Delivery[]>>, order: readonly string[]): string {
  const names = Object.keys(arms);
  const short = (m: string): string => m.replace(/^claude-/, '').replace(/-\d+-\d+$/, '');
  const cell = (d: Delivery | undefined): string => (d ? `${d.own ? 'yes' : 'no'}${d.others.length ? ` (+ ${d.others.map(short).join(', ')})` : ''}` : 'not reached');
  const lines = [`| Path | Model of the request | ${names.join(' | ')} |`, `| --- | --- | ${names.map(() => '---').join(' | ')} |`];
  for (const p of order) {
    const model = names.map((n) => arms[n]?.find((d) => d.path === p)?.model).find(Boolean) ?? '';
    lines.push(`| ${p} | ${model} | ${names.map((n) => cell(arms[n]?.find((d) => d.path === p))).join(' | ')} |`);
  }
  return `${lines.join('\n')}\n`;
}
