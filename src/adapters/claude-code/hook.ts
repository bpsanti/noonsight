// The Claude Code hook adapter for the main session: SessionStart and PostModelSwitch.
//
// Contract (docs/hooks.md has the full table):
//   - Always exits 0 and never holds the session: it reads local files only, never the network,
//     and starts no process.
//   - Prints nothing, or one JSON object: additionalContext for Claude, systemMessage for the person.
//   - Writes one line to the decision log for every decision it makes.
//   - A configuration with any problem is refused whole: nothing is delivered, the person is warned,
//     and the log records config-invalid.

import fs from 'node:fs';
import { ConfigError, loadConfig } from '../../config/load.js';
import { configPath, stateDir, type Env } from '../../config/paths.js';
import { normalizeModel } from '../../core/normalize.js';
import { joinDelivery, resolve, switchNote } from '../../core/resolve.js';
import type { Config, Decision } from '../../core/types.js';
import { appendDecision } from '../../state/log.js';
import { processFile, pruneState, readState, sessionFile, writeState, type DeliveryState } from '../../state/sessions.js';
import type { InstallKind } from './locations.js';
import { HOOK_EVENTS, type HookEvent } from './settings.js';

export interface HookContext {
  readonly env: Env;
  readonly home: string;
  readonly now: Date;
  /** The sextant version, recorded in the log. */
  readonly version: string;
  /** Which install ran the hook, as the hook pointer reports it. */
  readonly install: InstallKind | null;
  /** The process that started the hook: the Claude Code process running the session. */
  readonly parentPid: number;
}

/** Run one hook event. Returns what to print on stdout (possibly nothing). Never throws. */
export function runHook(arg: string, rawInput: string, ctx: HookContext): string {
  if (ctx.env.SEXTANT_DISABLE === '1') return '';
  const event = (Object.keys(HOOK_EVENTS) as HookEvent[]).find((e) => HOOK_EVENTS[e] === arg);
  if (!event) return '';
  const input = parseInput(rawInput);
  // Anything that is not this Claude Code event (another tool reading the same settings, a hand
  // run, a renamed event) is left alone, silently.
  if (!input || input.hook_event_name !== event) return '';

  const state = stateDir(ctx.home);
  const record: Record<string, unknown> = {
    ts: ctx.now.toISOString(),
    version: ctx.version,
    event: arg,
    session_id: str(input.session_id),
    source: str(input.source),
    install: ctx.install,
  };
  const log = (fields: Record<string, unknown>): void => {
    try {
      appendDecision(state, { ...record, ...fields });
    } catch {
      // A log that cannot be written must not cost the session its rules.
    }
  };

  try {
    const file = configPath(ctx.env, ctx.home);
    // A machine-wide install reaches every account; an account that never set sextant up is left alone.
    if (!ctx.env.SEXTANT_CONFIG && !fs.existsSync(file)) return '';
    record.config = file;
    let config: Config;
    try {
      config = loadConfig(file, {}, ctx.env);
    } catch (e) {
      if (!(e instanceof ConfigError)) throw e;
      log({ status: 'config-invalid', problems: e.problems.length, delivered: 'nothing', warned: true });
      return output(event, null, [
        `sextant: the configuration at ${file} was refused (${plural(e.problems.length, 'problem')}), ` +
          'so no rules were delivered. Run `sextant check` to see the problems.',
      ]);
    }
    const sessionId = str(input.session_id) ?? '';
    const sessionState = sessionFile(state, sessionId);
    const processState = processFile(state, ctx.parentPid);
    const result =
      event === 'SessionStart'
        ? sessionStart(input, config, file, readState(sessionState), readState(processState))
        : modelSwitch(input, config, file, readState(sessionState));
    log(result.record);
    if (result.state) {
      const saved: DeliveryState = { ...result.state, at: ctx.now.toISOString() };
      try {
        writeState(sessionState, saved);
        writeState(processState, saved);
        if (event === 'SessionStart' && input.source === 'startup') pruneState(state, ctx.now.getTime());
      } catch {
        // Without the record, a later resume delivers again: the safe direction.
      }
    }
    return output(event, result.context, result.messages);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log({ status: 'error', error: message, delivered: 'nothing', warned: true });
    return output(event, null, [`sextant: the hook failed (${message}), so no rules were delivered.`]);
  }
}

interface Outcome {
  readonly record: Record<string, unknown>;
  readonly context: string | null;
  readonly messages: readonly string[];
  /** What the session holds after this decision, or null to leave the record as it was. */
  readonly state: Omit<DeliveryState, 'at'> | null;
}

/**
 * SessionStart, by how the session started:
 *   startup         deliver
 *   clear, compact  deliver again: the earlier context, and the rules in it, are gone
 *   resume, fork    deliver only when the model or the rules changed since this session's record
 *   anything else   deliver: delivering twice costs little, missing a delivery is the defect
 */
function sessionStart(
  input: Record<string, unknown>,
  config: Config,
  file: string,
  session: DeliveryState | null,
  process: DeliveryState | null,
): Outcome {
  const source = str(input.source);
  const reported = normalizeModel(str(input.model));
  // Claude Code can leave the model out, for example after /clear. The same session, or for /clear
  // and compaction the same Claude Code process, still runs the model recorded last.
  const recorded = session?.model ?? (source === 'clear' || source === 'compact' ? process?.model : null) ?? null;
  const model = reported || recorded;
  const modelSource = reported ? 'hook-input' : recorded ? (session?.model ? 'session-record' : 'process-record') : null;
  const decision = resolve(config, { model, scope: null, place: 'session' });
  const sha = decision.status === 'matched' ? decision.sha256 : null;
  const repeat = (source === 'resume' || source === 'fork') && session !== null && session.model === decision.model && session.sha256 === sha;

  const context = decision.status === 'matched' && !repeat ? decision.text : null;
  const messages = repeat ? [] : undeclaredMessages(decision, file);
  return {
    record: {
      ...decisionFields(decision),
      model_source: modelSource,
      delivered: repeat ? 'already-delivered' : context ? 'rules' : 'nothing',
      warned: messages.length > 0,
    },
    context,
    messages,
    state: decision.model === null ? null : { model: decision.model, status: decision.status, sha256: sha },
  };
}

/**
 * PostModelSwitch: deliver the new model's rules. The rules delivered for the previous model stay in
 * the conversation, so when the previous model had rules, a note says they no longer apply.
 */
function modelSwitch(input: Record<string, unknown>, config: Config, file: string, session: DeliveryState | null): Outcome {
  const to = normalizeModel(str(input.to_model));
  const from = normalizeModel(str(input.from_model));
  const decision = resolve(config, { model: to, scope: null, place: 'session' });
  const sha = decision.status === 'matched' ? decision.sha256 : null;
  const base = { ...decisionFields(decision), model_source: 'hook-input', from_model: from || null };
  const state = decision.model === null ? null : { model: decision.model, status: decision.status, sha256: sha };

  // Resuming a session restores its model and reports it as a switch; the rules may already be there.
  if (session !== null && session.model === decision.model && session.sha256 === sha)
    return { record: { ...base, delivered: 'already-delivered', warned: false }, context: null, messages: [], state };

  const previous = session ? session.model : from || null;
  const previousHadRules = session
    ? session.status === 'matched'
    : previous !== null && resolve(config, { model: previous, scope: null, place: 'session' }).status === 'matched';
  const note = previous !== null && previousHadRules && previous !== decision.model ? switchNote(previous, to) : null;
  const parts = [...(note ? [note] : []), ...(decision.status === 'matched' ? [decision.text] : [])];
  const messages = undeclaredMessages(decision, file);
  return {
    record: {
      ...base,
      delivered: decision.status === 'matched' ? (note ? 'rules+note' : 'rules') : note ? 'note' : 'nothing',
      warned: messages.length > 0,
    },
    context: parts.length ? joinDelivery(parts) : null,
    messages,
    state,
  };
}

function undeclaredMessages(decision: Decision, file: string): string[] {
  if (decision.status !== 'undeclared' || decision.warning === undefined) return [];
  return [
    decision.reason === 'model-not-reported'
      ? "sextant: Claude Code did not report this session's model, so no rules were delivered."
      : `sextant: ${decision.model} is not declared in ${file}, so this session gets no rules. ` +
        'Declare it under "models" (with "use": "none" if it needs no rules).',
  ];
}

function decisionFields(d: Decision): Record<string, unknown> {
  return {
    model: d.model,
    status: d.status,
    ...('reason' in d ? { reason: d.reason } : {}),
    ...('key' in d ? { key: d.key } : {}),
    ...(d.status === 'matched' ? { rules: d.rules, sha256: d.sha256 } : {}),
  };
}

function output(event: HookEvent, context: string | null, messages: readonly string[]): string {
  if (!context && messages.length === 0) return '';
  return JSON.stringify({
    ...(messages.length ? { systemMessage: messages.join('\n') } : {}),
    ...(context ? { hookSpecificOutput: { hookEventName: event, additionalContext: context } } : {}),
  });
}

function parseInput(raw: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(raw) as unknown;
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
