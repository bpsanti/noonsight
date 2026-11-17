// What one pilot run left behind, turned into its result line. The signal definitions are phase 9's
// (experiments/rules/score.ts), with the test commands widened to the ecosystems these tasks use.
// Every function here is pure over its inputs.

import { handsBack, prose, toolCalls, type Prose, type ToolCall } from '../rules/score.js';
import { CONTAINER } from './conditions.js';

/** Claude Code's stream-json events, from the log Harbor keeps (agent/claude-code.txt). */
export function parseStream(text: string): Record<string, any>[] {
  return text
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Record<string, any>];
      } catch {
        return [];
      }
    });
}

export interface Usage {
  /** The result event's subtype: success, or why the run stopped, such as error_max_budget_usd. */
  readonly outcome: string;
  readonly cost_usd: number | null;
  readonly tokens: { readonly input: number; readonly cache_creation: number; readonly cache_read: number; readonly output: number };
  readonly turns: number;
  readonly duration_ms: number;
  readonly models_used: readonly string[];
  readonly final: string;
}

/** The totals the last result event reports, summed over every model the session used. */
export function usage(stream: readonly Record<string, any>[]): Usage {
  const result = stream.filter((e) => e.type === 'result').at(-1);
  const t = { input: 0, cache_creation: 0, cache_read: 0, output: 0 };
  for (const u of Object.values((result?.modelUsage ?? {}) as Record<string, Record<string, number>>)) {
    t.input += u.inputTokens ?? 0;
    t.cache_creation += u.cacheCreationInputTokens ?? 0;
    t.cache_read += u.cacheReadInputTokens ?? 0;
    t.output += u.outputTokens ?? 0;
  }
  return {
    outcome: result ? String(result.subtype ?? 'unknown') : 'no-result',
    cost_usd: result && typeof result.total_cost_usd === 'number' ? result.total_cost_usd : null,
    tokens: t,
    turns: Number(result?.num_turns ?? 0),
    duration_ms: Number(result?.duration_ms ?? 0),
    models_used: Object.keys(result?.modelUsage ?? {}),
    final: String(result?.result ?? ''),
  };
}

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
/** Commands that run code or its checks: test runners, builds and type checkers of the tasks' ecosystems. */
export const CHECK_COMMAND =
  /\b(py\.?test|python[0-9.]*\s+(-m\s+(pytest|unittest|tox|mypy)|\S*(test|runtests)\S*\.py|-c\b)|tox\b|mypy\b|bin\/test\b|runtests\.py|setup\.py\s+test|make\s+(test|check|all)?\b|npm\s+(run\s+)?(test|build)\b|npm\s+t\b|node\s+--test|go\s+(test|build|vet)\b|cargo\s+(test|build|check)\b|gcc\b|g\+\+|clang\b|bash\s+\S*test\S*|\.\/\S*test\S*)/;

/**
 * A shell command that changes a file in place: a Python script that writes a file, sed or perl in
 * place, a patch, or output redirected into a file outside /logs and /tmp (where the answers of open
 * tasks and scratch files go). A heuristic: the diff saved after the run is what changed for sure.
 */
export const EDIT_COMMAND = /\bpython[0-9.]*\s+(-\s*<<|-c\s)[\s\S]*?(\.write(_text|_bytes)?\(|open\([^)]*,\s*['"][wa]b?['"])|\bsed\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*i|\bperl\s+-[a-zA-Z]*i|\bpatch\s|\bgit\s+apply\b|\btee\s+(-a\s+)?(?!\/logs\/|\/tmp\/|\/dev\/)\S|(^|[^0-9&>])>>?\s*(?!\/logs\/|\/tmp\/|\/dev\/|&)[\w./-]+\.\w+/;

function isBash(c: ToolCall): boolean {
  return c.name.toLowerCase() === 'bash' && !c.denied;
}

/** Where in a shell command the last in-place edit and the last check start, or -1. */
function positions(command: string): { edit: number; check: number } {
  const last = (re: RegExp): number => {
    let at = -1;
    for (const m of command.matchAll(new RegExp(re.source, 'g'))) at = m.index ?? at;
    return at;
  };
  return { edit: last(EDIT_COMMAND), check: last(CHECK_COMMAND) };
}

/**
 * Whether the run checked its change for real: a check or run command, allowed to run, after the
 * last edit of a file outside /logs (where the answers of open tasks go). An edit is an Edit or
 * Write call, or a shell command that changes a file in place; a check in the same shell command,
 * after its edit, counts.
 */
export function verification(calls: readonly ToolCall[]): { edited: boolean; ran_checks: boolean; verified: boolean } {
  let lastEdit = -1;
  let checkedInEdit = false;
  calls.forEach((c, i) => {
    if (EDIT_TOOLS.has(c.name) && !c.denied) {
      const file = String(c.input.file_path ?? c.input.notebook_path ?? '');
      if (!file.startsWith('/logs/')) {
        lastEdit = i;
        checkedInEdit = false;
      }
    } else if (isBash(c)) {
      const at = positions(String(c.input.command ?? ''));
      if (at.edit >= 0) {
        lastEdit = i;
        checkedInEdit = at.check > at.edit;
      }
    }
  });
  const checks = calls.map((c, i) => [c, i] as const).filter(([c]) => isBash(c) && CHECK_COMMAND.test(String(c.input.command ?? '')));
  return { edited: lastEdit >= 0, ran_checks: checks.length > 0, verified: lastEdit >= 0 && (checkedInEdit || checks.some(([, i]) => i > lastEdit)) };
}

/** The index of the first call that edits a file outside /logs, or -1. */
function firstEdit(calls: readonly ToolCall[]): number {
  return calls.findIndex((c) => {
    if (EDIT_TOOLS.has(c.name) && !c.denied) return !String(c.input.file_path ?? c.input.notebook_path ?? '').startsWith('/logs/');
    return isBash(c) && positions(String(c.input.command ?? '')).edit >= 0;
  });
}

/**
 * Whether the run read a given file: a Read of it, a Grep in it, or a shell command that names it
 * (cat, head, sed and the like); and whether it did before its first edit. For the scattered
 * condition, whose rules reach the session only if the agent reads them.
 */
export function readFile(calls: readonly ToolCall[], file: string): { read: boolean; before_first_edit: boolean } {
  const reads = calls
    .map((c, i) => [c, i] as const)
    .filter(([c]) => !c.denied && ((c.name === 'Read' && c.input.file_path === file) || (c.name === 'Grep' && c.input.path === file) || (isBash(c) && String(c.input.command ?? '').includes(file))))
    .map(([, i]) => i);
  if (reads.length === 0) return { read: false, before_first_edit: false };
  const edit = firstEdit(calls);
  return { read: true, before_first_edit: edit < 0 || (reads[0] as number) < edit };
}

export interface Signals {
  readonly handed_back: boolean;
  readonly edited: boolean;
  readonly ran_checks: boolean;
  readonly verified: boolean;
  readonly tool_calls: number;
  readonly denied: number;
  readonly subagents: number;
  /** Whether the run read the scattered condition's rules file, and before its first edit. */
  readonly read_rules: { readonly read: boolean; readonly before_first_edit: boolean };
  readonly report: Prose;
}

/** The mechanism signals of a run; `report` is the answer of an open task, or the final message. */
export function signals(stream: readonly Record<string, any>[], report: string): Signals {
  const calls = toolCalls(stream);
  const final = usage(stream).final;
  return {
    handed_back: handsBack(final),
    ...verification(calls),
    tool_calls: calls.length,
    denied: calls.filter((c) => c.denied).length,
    subagents: calls.filter((c) => c.name === 'Agent' || c.name === 'Task').length,
    read_rules: readFile(calls, CONTAINER.rulesFile),
    report: prose(report),
  };
}
