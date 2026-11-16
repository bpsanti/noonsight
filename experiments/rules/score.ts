// The outcome signals of one experiment run, computed from what the run left behind: the stream of
// events Claude Code printed, the project directory after the run, and the report it wrote. Each
// signal stands for an effect a rule's source claims; README.md maps rules to signals. Every
// function here is pure over its inputs, so the scoring is tested without a model.

import fs from 'node:fs';
import path from 'node:path';

/** Measures of how dense a written report is, the effect the low-context report rule's source describes. */
export interface Prose {
  readonly words: number;
  readonly sentences: number;
  readonly words_per_sentence: number;
  readonly semicolons_per_1k_words: number;
  /** Parenthetical asides per 1,000 words. */
  readonly parentheses_per_1k_words: number;
  readonly bullets: number;
  readonly table_rows: number;
}

/**
 * Measure the prose of a Markdown text. Fenced code blocks are left out; table rows and headings are
 * counted apart and left out of the sentences. Each bullet or numbered item counts as at least one
 * sentence, and a line is split into sentences after ".", "!" or "?" followed by a space.
 */
export function prose(markdown: string): Prose {
  let inFence = false;
  let tableRows = 0;
  let bullets = 0;
  const sentences: string[] = [];
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (/^(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || line === '' || /^#{1,6}\s/.test(line) || /^[-*_]{3,}$/.test(line)) continue;
    if (line.startsWith('|')) {
      if (!/^\|[\s:|-]+\|?$/.test(line)) tableRows++;
      continue;
    }
    const item = /^([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) bullets++;
    const body = item ? (item[2] ?? '') : line;
    for (const s of body.split(/(?<=[.!?])\s+/)) if (wordCount(s) > 0) sentences.push(s);
  }
  const words = sentences.reduce((n, s) => n + wordCount(s), 0);
  const text = sentences.join(' ').replace(/`[^`]*`/g, '');
  const per1k = (n: number): number => (words ? round((n * 1000) / words) : 0);
  return {
    words,
    sentences: sentences.length,
    words_per_sentence: sentences.length ? round(words / sentences.length) : 0,
    semicolons_per_1k_words: per1k((text.match(/;/g) ?? []).length),
    parentheses_per_1k_words: per1k((text.match(/\(/g) ?? []).length),
    bullets,
    table_rows: tableRows,
  };
}

function wordCount(s: string): number {
  return (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’_./:-]*/gu) ?? []).length;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Whether a final message hands the work back instead of ending it: an offer to go on, or a
 * question to the person. Only the end of the message is read, where such an offer sits. This is a
 * heuristic over wording, so the summary also gives the deliverable check beside it.
 */
export function handsBack(message: string): boolean {
  const tail = message.trim().slice(-600);
  return /\b(would you like|do you want|shall i|should i|let me know|if you('d| would) like|want me to|happy to|i can also|next steps?:)/i.test(tail);
}

/** The job names after the answer line of the question task, or null when the line is missing. */
export function answerLine(report: string, prefix: string): string[] | null {
  const lines = report.trim().split('\n').map((l) => l.trim().replace(/^[`*_]+|[`*_]+$/g, ''));
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i] ?? '';
    if (!line.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    const rest = line
      .slice(prefix.length)
      .replace(/[`*_]/g, '')
      .trim()
      .replace(/\.$/, '');
    if (rest.toLowerCase() === 'none') return [];
    return rest
      .split(/,|\band\b/)
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean);
  }
  return null;
}

/** How the named jobs compare with the expected ones. */
export function answerScore(named: readonly string[] | null, expected: readonly string[]): { found: number; expected: number; wrong: number } {
  const want = new Set(expected.map((n) => n.toLowerCase()));
  const got = new Set((named ?? []).map((n) => n.replace(/\.js$/, '')));
  return { found: [...got].filter((n) => want.has(n)).length, expected: want.size, wrong: [...got].filter((n) => !want.has(n)).length };
}

/** One tool call from the stream, with what came back for it. */
export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly input: Record<string, unknown>;
  readonly denied: boolean;
}

/** The tool calls of the main session, in order, from Claude Code's stream-json events. */
export function toolCalls(stream: readonly Record<string, any>[]): ToolCall[] {
  const result = stream.filter((e) => e.type === 'result').at(-1);
  const denied = new Set<string>(((result?.permission_denials ?? []) as Record<string, any>[]).map((d) => String(d.tool_use_id)));
  const calls: ToolCall[] = [];
  for (const e of stream) {
    if (e.type !== 'assistant' || e.parent_tool_use_id) continue;
    for (const c of (e.message?.content ?? []) as Record<string, any>[])
      if (c.type === 'tool_use') calls.push({ id: String(c.id), name: String(c.name), input: (c.input ?? {}) as Record<string, unknown>, denied: denied.has(String(c.id)) });
  }
  return calls;
}

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const TEST_COMMAND = /\b(npm\s+(run\s+)?test|npm\s+t\b|node\s+(--test|\S*test\S*\.m?js)|node\s+-e\b.*\bimport\b)/;

/**
 * Whether the run checked its change for real, the effect the verify-changes rules' sources claim:
 * a test or run command that was allowed to run, after the last edit of a file other than the ones
 * named in `ignore` (such as the report itself).
 */
export function verification(calls: readonly ToolCall[], projectDir: string, ignore: readonly string[] = []): { edited: boolean; ran_tests: boolean; verified: boolean } {
  let lastEdit = -1;
  calls.forEach((c, i) => {
    if (!EDIT_TOOLS.has(c.name) || c.denied) return;
    const file = String(c.input.file_path ?? c.input.notebook_path ?? '');
    const rel = path.isAbsolute(file) ? path.relative(projectDir, file) : file;
    if (!ignore.includes(rel)) lastEdit = i;
  });
  const tests = calls.map((c, i) => [c, i] as const).filter(([c]) => c.name === 'Bash' && !c.denied && TEST_COMMAND.test(String(c.input.command ?? '')));
  return { edited: lastEdit >= 0, ran_tests: tests.length > 0, verified: lastEdit >= 0 && tests.some(([, i]) => i > lastEdit) };
}

/** Files added, removed or changed in `after` compared with `before`, as sorted relative paths. */
export function changedFiles(before: string, after: string, skip: readonly string[] = ['.claude', '.git', 'node_modules']): string[] {
  const a = listFiles(before, skip);
  const b = listFiles(after, skip);
  const changed = new Set<string>();
  for (const f of new Set([...a, ...b])) {
    if (!a.has(f) || !b.has(f)) changed.add(f);
    else if (!fs.readFileSync(path.join(before, f)).equals(fs.readFileSync(path.join(after, f)))) changed.add(f);
  }
  return [...changed].sort();
}

function listFiles(root: string, skip: readonly string[]): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.add(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out;
}
