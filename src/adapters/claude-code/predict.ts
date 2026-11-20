// The model a subagent will run on, decided before it starts, the way Claude Code decides it
// (https://code.claude.com/docs/en/sub-agents, "Choose a model" and "Built-in subagents"):
//
//   1. the model parameter of the agent call, an alias;
//   2. the model field of the subagent's definition, or of a built-in subagent;
//   3. the CLAUDE_CODE_SUBAGENT_MODEL environment variable;
//   4. the model of whoever starts it: the session, or the subagent that starts a nested one.
//
// A family alias (opus, sonnet, haiku, fable) selects the parent's own model when the parent is of
// that family. With CLAUDE_CODE_SUBAGENT_MODEL_FORCE set, definitions and the call's parameter are
// ignored. A fork always runs on its parent's model.
//
// The prediction is checked after the subagent starts: the result of the agent call names the model
// it started on (resolvedModel), and a difference is logged and shown.

import fs from 'node:fs';
import path from 'node:path';
import type { Env } from '../../config/paths.js';
import { repositoryRoot } from '../../config/project.js';
import { normalizeModel } from '../../core/normalize.js';
import { isSet, otherProvider, resolveModelValue } from './launch.js';

/** Where the prediction came from, as the decision log records it. */
export type PredictionSource = 'fork' | 'forced' | 'parameter' | 'definition' | 'built-in' | 'env' | 'parent';

export interface Prediction {
  /** The normalized model, or null when noonsight cannot tell. */
  readonly model: string | null;
  readonly source: PredictionSource;
  /** What the source named, such as an alias, when it named a model. */
  readonly value?: string;
  /** The definition file that decided, or "not-read" for a plugin's subagent. */
  readonly definition?: string;
  /** Why the model could not be told. */
  readonly why?: string;
}

/** A subagent definition: a Markdown file whose frontmatter names the subagent and may set its model. */
export interface Definition {
  readonly file: string;
  readonly model: string | null;
  readonly effort: string | null;
}

export interface PredictInput {
  /** The subagent_type of the call; general-purpose when the call names none. */
  readonly subagentType: string;
  /** The model parameter of the call, if any. */
  readonly requested: string | null;
  /** The model of whoever starts the subagent, or null when it is not known. */
  readonly parent: string | null;
  readonly env: Env;
  /** Finds a user or project definition by name; null when there is none. */
  readonly findDefinition: (name: string) => Definition | null;
}

/**
 * The built-in subagents whose model does not simply follow the order above, from
 * https://code.claude.com/docs/en/sub-agents, "Built-in subagents" (read 2026-11-15). A definition
 * of the same name replaces a built-in, with its own model field.
 */
const BUILT_IN_MODELS: Readonly<Record<string, string>> = {
  'statusline-setup': 'sonnet',
  'claude-code-guide': 'haiku',
};

/** Built-ins that run on their parent's model even when CLAUDE_CODE_SUBAGENT_MODEL is set. */
const PARENT_BUILT_INS = new Set(['Explore', 'Plan']);

/**
 * The built-in web-fetch subagent, which the documentation does not list. Claude Code 2.1.326 gives it
 * the model the haiku alias selects when it runs on the Anthropic API, and its parent's model on
 * another provider, as its built-in definition reads.
 */
const WEB_FETCH = 'web-fetch';

const FAMILIES = ['opus', 'sonnet', 'haiku', 'fable'] as const;

export function predict(input: PredictInput): Prediction {
  const { subagentType: type, requested, parent, env } = input;
  const subagentModel = env.CLAUDE_CODE_SUBAGENT_MODEL?.trim() || null;

  if (type === 'fork') return fromParent(parent, 'fork');

  if (isSet(env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE)) {
    if (subagentModel !== null) return fromValue(subagentModel, parent, env, 'forced');
    // Forced onto the session's model, except that Explore keeps its own rule.
    if (type === 'Explore') return explore(parent, env);
    return fromParent(parent, 'forced');
  }

  if (requested !== null) return fromValue(requested, parent, env, 'parameter');

  if (type.includes(':')) {
    // A plugin's subagent. Its definition is not read, so a model it sets is not seen; the check
    // after the subagent starts reports the difference.
    return subagentModel !== null
      ? { ...fromValue(subagentModel, parent, env, 'env'), definition: 'not-read' }
      : { ...fromParent(parent, 'parent'), definition: 'not-read' };
  }

  const definition = input.findDefinition(type);
  if (definition !== null) {
    if (definition.model !== null) return { ...fromValue(definition.model, parent, env, 'definition'), definition: definition.file };
  } else {
    if (type === 'Explore') return explore(parent, env);
    if (PARENT_BUILT_INS.has(type)) return fromParent(parent, 'built-in');
    if (type === WEB_FETCH) return otherProvider(env) !== undefined ? fromParent(parent, 'built-in') : fromValue('haiku', parent, env, 'built-in');
    const builtIn = BUILT_IN_MODELS[type];
    if (builtIn !== undefined) return fromValue(builtIn, parent, env, 'built-in');
  }

  if (subagentModel !== null) return fromValue(subagentModel, parent, env, 'env');
  return fromParent(parent, 'parent');
}

/**
 * The built-in Explore subagent runs on its parent's model, except under a Fable parent: with a
 * Claude subscription, an Anthropic Console account or a gateway reached through ANTHROPIC_BASE_URL
 * it runs on the model the opus alias selects; on Amazon Bedrock, Google Cloud and Microsoft
 * Foundry it stays on Fable.
 */
function explore(parent: string | null, env: Env): Prediction {
  if (parent === null || familyOf(parent) !== 'fable' || otherProvider(env) !== undefined) return fromParent(parent, 'built-in');
  return fromValue('opus', parent, env, 'built-in');
}

function fromParent(parent: string | null, source: PredictionSource): Prediction {
  if (parent === null) return { model: null, source, why: 'the model of the session or subagent that starts it is not known' };
  return { model: parent, source };
}

/** The model a value names for a subagent: inherit, a family alias, another alias or a model identifier. */
function fromValue(value: string, parent: string | null, env: Env, source: PredictionSource): Prediction {
  const bare = value.trim().toLowerCase();
  if (bare === 'inherit') return { ...fromParent(parent, source), value };
  const family = FAMILIES.find((f) => f === bare.replace(/\[1m\]$/, ''));
  if (family !== undefined && parent !== null && familyOf(parent) === family) return { model: parent, source, value };
  const r = resolveModelValue(value, env);
  if (r.kind === 'unresolved') return { model: null, source, value, why: `"${value}" cannot be pinned down: ${r.why}` };
  return { model: r.model, source, value };
}

/** The family of a normalized model identifier, such as sonnet for claude-sonnet-5-5. */
export function familyOf(model: string): string | null {
  return FAMILIES.find((f) => new RegExp(`(?:^|-)${f}(?:-|$)`).test(model)) ?? null;
}

// ---------------------------------------------------------------------------------------------
// Subagent definitions (https://code.claude.com/docs/en/sub-agents, "Choose the subagent scope"):
// project definitions in every .claude/agents/ from the working directory up to the repository
// root, the closest first, then the user's in <configuration directory>/agents/. Both are scanned
// recursively, and a subagent is known by the name in its frontmatter, never by its file name.
// Managed definitions and those given with --agents are not read.

const MAX_DEPTH = 6;
const MAX_FILES = 2000;
const HEAD_BYTES = 8192;

export interface DefinitionPlaces {
  /** The session's project directory, where the walk up starts. */
  readonly projectDir: string | null;
  /** The Claude Code configuration directory of the account. */
  readonly configDir: string;
}

export function definitionFinder(places: DefinitionPlaces): (name: string) => Definition | null {
  return (name) => {
    for (const dir of definitionDirs(places)) {
      const found = findIn(dir, name);
      if (found !== null) return found;
    }
    return null;
  };
}

function definitionDirs(places: DefinitionPlaces): string[] {
  const dirs: string[] = [];
  if (places.projectDir !== null) {
    const start = path.resolve(places.projectDir);
    const top = repositoryRoot(start);
    for (let d = start; ; d = path.dirname(d)) {
      dirs.push(path.join(d, '.claude', 'agents'));
      if (d === top) break;
    }
  }
  dirs.push(path.join(places.configDir, 'agents'));
  return [...new Set(dirs)];
}

function findIn(root: string, name: string): Definition | null {
  let seen = 0;
  const walk = (dir: string, depth: number): Definition | null => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      if (++seen > MAX_FILES) return null;
      const file = path.join(dir, e.name);
      if (e.isFile() && e.name.endsWith('.md')) {
        const fm = frontmatter(readHead(file));
        if (fm !== null && fm.name === name) return { file, model: fm.model ?? null, effort: fm.effort ?? null };
      } else if (e.isDirectory() && depth < MAX_DEPTH) {
        const found = walk(file, depth + 1);
        if (found !== null) return found;
      }
    }
    return null;
  };
  return walk(root, 0);
}

/** The top-level name, model and effort of a definition's YAML frontmatter, or null when it has none. */
export function frontmatter(text: string): { name?: string; model?: string; effort?: string } | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!m) return null;
  const fields: { name?: string; model?: string; effort?: string } = {};
  for (const line of (m[1] ?? '').split(/\r?\n/)) {
    const f = /^(name|model|effort):[ \t]*(.*?)[ \t]*(?:#.*)?$/.exec(line);
    if (!f) continue;
    const value = (f[2] ?? '').replace(/^(['"])(.*)\1$/, '$2').trim();
    if (value) fields[f[1] as 'name' | 'model' | 'effort'] = value;
  }
  return fields;
}

function readHead(file: string): string {
  try {
    const fd = fs.openSync(file, 'r');
    try {
      const buffer = Buffer.alloc(HEAD_BYTES);
      const n = fs.readSync(fd, buffer, 0, HEAD_BYTES, 0);
      return buffer.toString('utf8', 0, n);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------------------------
// Transcripts. Claude Code writes each assistant message with the model that wrote it. A subagent's
// transcript sits next to the session's, at <session transcript dir>/<session id>/subagents/
// agent-<agent id>.jsonl, as the agent_transcript_path of the SubagentStop input shows
// (https://code.claude.com/docs/en/hooks, "SubagentStop input"). The documentation warns that a
// transcript can lag behind the conversation, so a transcript is read only when no record knows,
// except at a resume, when the conversation's earlier process has finished writing it.
//
// A compaction writes a system record with subtype compact_boundary, and the messages it kept are
// referred to there, not written again after it.

/** How much of a transcript is read at a time, from its end. */
const CHUNK_BYTES = 1024 * 1024;
/** How far back from its end a transcript is read at most, so the hook stays within its bound. */
const MAX_SCAN_BYTES = 64 * 1024 * 1024;

/** The model of the last assistant message in a transcript; for the session, its own messages only. */
export function transcriptModel(file: string | null, ownOnly: boolean): string | null {
  return lastResponse(file, ownOnly, false)?.model ?? null;
}

/** A response in a transcript: the model that wrote it, and when Claude Code wrote it, when it says. */
export interface Response {
  readonly model: string;
  /** Milliseconds since the epoch, or null when the record has no readable timestamp. */
  readonly at: number | null;
}

/**
 * The conversation's last response since its last compaction, its own messages only: its model is
 * the one Claude Code resumes a conversation on when nothing it was started with names one. Null when
 * the conversation has no response since, or the transcript cannot be read.
 */
export function conversationResponse(file: string | null): Response | null {
  return lastResponse(file, true, true);
}

/** The model of conversationResponse. */
export function conversationModel(file: string | null): string | null {
  return conversationResponse(file)?.model ?? null;
}

function lastResponse(file: string | null, ownOnly: boolean, sinceCompaction: boolean): Response | null {
  if (file === null) return null;
  let found: Response | null = null;
  try {
    scanLinesBackward(file, (line) => {
      const boundary = sinceCompaction && line.includes('"compact_boundary"');
      if (!boundary && !line.includes('"assistant"')) return false;
      let r: { type?: unknown; subtype?: unknown; isSidechain?: unknown; timestamp?: unknown; message?: { model?: unknown } };
      try {
        r = JSON.parse(line) as typeof r;
      } catch {
        // A torn line being written, or not a record.
        return false;
      }
      if (ownOnly && r.isSidechain === true) return false;
      if (boundary && r.type === 'system' && r.subtype === 'compact_boundary') return true;
      if (r.type !== 'assistant') return false;
      const model = typeof r.message?.model === 'string' ? normalizeModel(r.message.model) : '';
      if (!model || model === '<synthetic>') return false;
      const at = typeof r.timestamp === 'string' ? Date.parse(r.timestamp) : NaN;
      found = { model, at: Number.isNaN(at) ? null : at };
      return true;
    });
  } catch {
    return null;
  }
  return found;
}

/** Each line of a file, the last first, until `visit` returns true or MAX_SCAN_BYTES are read. */
function scanLinesBackward(file: string, visit: (line: string) => boolean): void {
  const fd = fs.openSync(file, 'r');
  try {
    let position = fs.fstatSync(fd).size;
    const floor = Math.max(0, position - MAX_SCAN_BYTES);
    // The start of the line the previous chunk ended in, which this chunk completes.
    let carry = Buffer.alloc(0);
    while (position > floor) {
      const length = Math.min(CHUNK_BYTES, position - floor);
      position -= length;
      const chunk = Buffer.alloc(length);
      fs.readSync(fd, chunk, 0, length, position);
      const buffer = carry.length ? Buffer.concat([chunk, carry]) : chunk;
      let end = buffer.length;
      for (let i = end - 1; i >= 0; i--) {
        if (buffer[i] !== 0x0a) continue;
        if (visit(buffer.toString('utf8', i + 1, end))) return;
        end = i;
      }
      carry = buffer.subarray(0, end);
    }
    // The file's first line; a line the scan's limit cut is not whole, so it is left out.
    if (position === 0 && carry.length) visit(carry.toString('utf8'));
  } finally {
    fs.closeSync(fd);
  }
}

/** Where a subagent's transcript is, given the session's transcript path from the hook input. */
export function subagentTranscript(sessionTranscript: string | null, sessionId: string | null, agentId: string): string | null {
  if (sessionTranscript === null || sessionId === null || !/^[A-Za-z0-9_-]+$/.test(agentId) || !/^[A-Za-z0-9_-]+$/.test(sessionId))
    return null;
  return path.join(path.dirname(sessionTranscript), sessionId, 'subagents', `agent-${agentId}.jsonl`);
}
