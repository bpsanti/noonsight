// The Claude Code hook adapter: SessionStart and PostModelSwitch for the session itself, PostToolUse
// on Edit and Write for the triggers the session reveals (triggers.ts), and PreToolUse and PostToolUse
// on the agent tool and SubagentStart for the subagents it starts (subagents.ts).
//
// Contract (docs/hooks.md has the full table):
//   - Always exits 0 and never holds the session beyond a bound: it reads local files only and never
//     the network itself. It starts no process, except `ps` on macOS to read the Claude Code command
//     line when nothing else names the session's model (launch.ts), or when `noonsight run` started the
//     session (launcher.ts); `git ls-files`, stopped after 3 seconds, for an edit of a code file until
//     the session reveals code-edit (code-edit.ts); and, with classifier.mode on, the classifier for
//     an agent call, stopped after classifier.timeout_ms (classifier.ts).
//   - Prints nothing, or one JSON object: hookSpecificOutput for Claude Code (session or subagent
//     context, or a subagent call routing changed), systemMessage for the person.
//   - Writes one line to the decision log for every decision it makes.
//   - A configuration with any problem is refused whole: nothing is delivered, the person is warned,
//     and the log records config-invalid.

import fs from 'node:fs';
import { ConfigError, loadConfig } from '../../config/load.js';
import { configPath, stateDir, type Env } from '../../config/paths.js';
import { normalizeModel } from '../../core/normalize.js';
import { joinDelivery, launcherNote, resolve, resolveAdded, switchNote } from '../../core/resolve.js';
import { sessionPlace, sessionScope, type PlaceChoice, type ScopeChoice } from '../../core/scope.js';
import type { Config, Decision, Trigger } from '../../core/types.js';
import { appendDecision } from '../../state/log.js';
import { processFile, pruneState, readState, sessionFile, writeState, type DeliveryState } from '../../state/sessions.js';
import { launchFields, launchModel, readCommandLine, type LaunchModel } from './launch.js';
import { launcherPrompt, type LauncherPrompt } from './launcher.js';
import type { InstallKind } from './locations.js';
import { HOOK_HANDLERS } from './settings.js';
import { notRouted } from './routing.js';
import { agentCall, agentResult, choiceFields, decisionFields, subagentStart } from './subagents.js';
import { fileEdit, mayReveal, revealedTriggers } from './triggers.js';

export interface HookContext {
  readonly env: Env;
  readonly home: string;
  readonly now: Date;
  /** The noonsight version, recorded in the log. */
  readonly version: string;
  /** Which install ran the hook, as the hook pointer reports it. */
  readonly install: InstallKind | null;
  /** The process that started the hook: the Claude Code process running the session. */
  readonly parentPid: number;
}

/** Run one hook event. Returns what to print on stdout (possibly nothing). Never throws. */
export function runHook(arg: string, rawInput: string, ctx: HookContext): string {
  if (ctx.env.NOONSIGHT_DISABLE === '1') return '';
  const spec = HOOK_HANDLERS.find((h) => h.arg === arg);
  if (!spec) return '';
  const event = spec.event;
  const input = parseInput(rawInput);
  // Anything that is not this Claude Code event (another tool reading the same settings, a hand
  // run, a renamed event) is left alone, silently.
  if (!input || input.hook_event_name !== event) return '';
  const toolEvent = spec.tools !== undefined;
  const editEvent = arg === 'file-edit';
  const subagentEvent = (toolEvent && !editEvent) || event === 'SubagentStart';
  // Each settings entry only matches its own tools; a hand-edited or widened matcher must not reach other tools.
  if (spec.tools !== undefined && !spec.tools.includes(str(input.tool_name) ?? '')) return '';

  const state = stateDir(ctx.home);
  // Every edit runs this hook; one that cannot reveal a trigger ends here, before the configuration is read.
  if (editEvent && !mayReveal(input, state)) return '';
  const record: Record<string, unknown> = {
    ts: ctx.now.toISOString(),
    version: ctx.version,
    event: arg,
    session_id: str(input.session_id),
    ...(toolEvent
      ? {
          tool_name: str(input.tool_name),
          tool_use_id: str(input.tool_use_id),
          ...(str(input.agent_id) !== null ? { agent_id: str(input.agent_id) } : {}),
          permission_mode: str(input.permission_mode),
        }
      : event === 'SubagentStart'
        ? { agent_id: str(input.agent_id) }
        : { source: str(input.source) }),
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
    // A machine-wide install reaches every account; an account that never set noonsight up is left alone.
    if (!ctx.env.NOONSIGHT_CONFIG && !fs.existsSync(file)) return '';
    record.config = file;
    let config: Config;
    try {
      config = loadConfig(file, {}, ctx.env);
    } catch (e) {
      if (!(e instanceof ConfigError)) throw e;
      // The call that started the subagent already warned, and logged that nothing was delivered; the
      // session's start already warned that the session got no rules.
      if (event === 'SubagentStart' || editEvent) return '';
      // The call this result belongs to already warned.
      if (event === 'PostToolUse') {
        log({ status: 'config-invalid', problems: e.problems.length, ...notRouted('config-invalid'), warned: false });
        return '';
      }
      log({ status: 'config-invalid', problems: e.problems.length, ...(event === 'PreToolUse' ? notRouted('config-invalid') : {}), delivered: 'nothing', warned: true });
      return output(
        [
          `noonsight: the configuration at ${file} was refused (${plural(e.problems.length, 'problem')}), ` +
            'so no rules were delivered. Run `noonsight check` to see the problems.',
        ],
        null,
      );
    }
    if (subagentEvent) {
      const sub = { env: ctx.env, home: ctx.home, now: ctx.now, state, parentPid: ctx.parentPid, file };
      const outcome =
        event === 'PreToolUse' ? agentCall(input, config, sub) : event === 'SubagentStart' ? subagentStart(input, config, sub) : agentResult(input, config, sub);
      if (outcome === null) return '';
      log(outcome.record);
      return output(outcome.messages, outcome.specific);
    }
    const sessionId = str(input.session_id) ?? '';
    const sessionState = sessionFile(state, sessionId);
    if (editEvent) {
      const outcome = fileEdit(input, config, { env: ctx.env, home: ctx.home, now: ctx.now, state, parentPid: ctx.parentPid });
      if (outcome === null) return '';
      log(outcome.record);
      if (outcome.state)
        try {
          writeState(sessionState, { ...outcome.state, at: ctx.now.toISOString() });
        } catch {
          // Without the record, a later resume delivers again: the safe direction.
        }
      return output([], outcome.context ? { hookEventName: event, additionalContext: outcome.context } : null);
    }
    const processState = processFile(state, ctx.parentPid);
    // Both come from the environment Claude Code runs in, which its hooks inherit.
    const where: Where = {
      scope: sessionScope(ctx.env),
      place: sessionPlace(config, ctx.env),
      triggers: revealedTriggers(config, state, str(input.session_id)),
    };
    const commandLine = once(() => readCommandLine(ctx.parentPid, process.platform));
    const result =
      event === 'SessionStart'
        ? sessionStart(
            input,
            config,
            file,
            where,
            readState(sessionState),
            readState(processState),
            () => launchModel({ env: ctx.env, home: ctx.home, pid: ctx.parentPid, cwd: str(input.cwd), commandLine }),
            () => launcherPrompt(ctx.env, commandLine),
          )
        : modelSwitch(input, config, file, where, readState(sessionState));
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
    return output(result.messages, result.context ? { hookEventName: event, additionalContext: result.context } : null);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // The edit itself is done, and a warning after every edit would only repeat; the log keeps the error.
    if (editEvent) {
      log({ status: 'error', error: message, delivered: 'nothing', warned: false });
      return '';
    }
    if (event === 'PostToolUse') {
      log({ status: 'error', error: message, ...notRouted('error'), warned: true });
      return output([`noonsight: the hook failed (${message}), so the subagent's model was not checked.`], null);
    }
    if (event === 'SubagentStart') {
      log({ status: 'error', error: message, delivered: 'nothing', warned: true });
      return output([`noonsight: the hook failed (${message}), so the subagent that started got no rules.`], null);
    }
    log({ status: 'error', error: message, ...(event === 'PreToolUse' ? notRouted('error') : {}), delivered: 'nothing', warned: true });
    return output([`noonsight: the hook failed (${message}), so no rules were delivered.`], null);
  }
}

/** A session's scope and place, and the triggers it has revealed. */
interface Where {
  readonly scope: ScopeChoice;
  readonly place: PlaceChoice;
  readonly triggers: readonly Trigger[];
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
 *
 * The model comes from the input; when Claude Code leaves it out, from the record of the same
 * session or, after /clear and compaction, of the same Claude Code process; and when neither knows
 * it, as in every `claude -p` run, from what the session was started with (launch.ts).
 *
 * A session `noonsight run` started already holds rules in its system prompt. Claude Code renders the
 * system prompt from the current launch for a new conversation, after /clear and after compaction,
 * so at those starts the rules are not delivered again when the launcher's text holds them. A resumed
 * or forked conversation keeps the system prompt it was first sent with, so the session record decides.
 * When the launcher's rules are for another model than the session's, a note says they do not apply.
 *
 * The rules are resolved with the triggers the session has revealed (triggers.ts), which its id keeps:
 * after compaction, the same session gets the rules a trigger added again; after /clear, a new session
 * starts with none.
 */
function sessionStart(
  input: Record<string, unknown>,
  config: Config,
  file: string,
  where: Where,
  session: DeliveryState | null,
  process: DeliveryState | null,
  readLaunch: () => LaunchModel,
  readLauncher: () => LauncherPrompt | null,
): Outcome {
  const source = str(input.source);
  const reported = normalizeModel(str(input.model));
  const recorded = session?.model ?? (source === 'clear' || source === 'compact' ? process?.model : null) ?? null;
  const launch = reported || recorded ? null : readLaunch();
  const launched = launch?.kind === 'found' ? launch.model : null;
  const model = reported || recorded || launched;
  const modelSource = reported
    ? 'hook-input'
    : recorded
      ? session?.model
        ? 'session-record'
        : 'process-record'
      : launch?.kind === 'found'
        ? launch.source
        : null;
  const request = { model, scope: where.scope.scope, place: where.place.place, triggers: where.triggers };
  const decision = resolve(config, request);
  const sha = decision.status === 'matched' ? decision.sha256 : null;
  const repeat = (source === 'resume' || source === 'fork') && session !== null && session.model === decision.model && session.sha256 === sha;

  const launcher = source === 'startup' || source === 'clear' || source === 'compact' ? readLauncher() : null;
  // The launcher's system prompt holds the rules for the session's scope; it never holds those a
  // trigger the session revealed later added, which are delivered here.
  const forLauncher = where.triggers.length ? resolve(config, { ...request, triggers: [] }) : decision;
  const inPrompt = launcher !== null && forLauncher.status === 'matched' && launcher.content.includes(forLauncher.text);
  const added = inPrompt && where.triggers.length ? resolveAdded(config, request, []) : null;
  const sent = inPrompt ? (added?.status === 'matched' ? added : null) : decision.status === 'matched' ? decision : null;
  const otherModel = launcher !== null && !inPrompt && launcher.model !== null && launcher.model !== decision.model ? launcher.model : null;
  const rules = sent !== null && !repeat ? sent.text : null;
  const note = otherModel !== null ? launcherNote(otherModel, decision.model ?? '') : null;
  const parts = [...(note ? [note] : []), ...(rules ? [rules] : [])];
  const messages = repeat
    ? []
    : [
        ...(otherModel !== null
          ? [
              `noonsight: noonsight run put the rules for ${otherModel} in the system prompt, but this session runs on ${decision.model ?? 'a model Claude Code did not report'}; ` +
                'the session was told that those rules do not apply.',
            ]
          : []),
        ...undeclaredMessages(decision, file, launch),
      ];
  return {
    record: {
      // Rules sent beside the launcher's are only those a trigger added, so the line names those.
      ...decisionFields(sent !== null && sent !== decision && !repeat ? sent : decision),
      ...choiceFields(where.scope, where.place),
      ...triggerFields(where.triggers),
      model_source: modelSource,
      ...launchFields(launch),
      ...(launcher !== null ? { launch_file: launcher.file, launch_model: launcher.model } : {}),
      delivered: repeat ? 'already-delivered' : rules ? (note ? 'rules+note' : 'rules') : inPrompt ? 'launcher' : note ? 'note' : 'nothing',
      warned: messages.length > 0,
    },
    context: parts.length ? joinDelivery(parts) : null,
    messages,
    state: decision.model === null ? null : { model: decision.model, status: decision.status, sha256: sha },
  };
}

/**
 * PostModelSwitch: deliver the new model's rules. The rules delivered for the previous model stay in
 * the conversation, so when the previous model had rules, a note says they no longer apply.
 */
function modelSwitch(input: Record<string, unknown>, config: Config, file: string, where: Where, session: DeliveryState | null): Outcome {
  const to = normalizeModel(str(input.to_model));
  const from = normalizeModel(str(input.from_model));
  const request = { scope: where.scope.scope, place: where.place.place, triggers: where.triggers };
  const decision = resolve(config, { model: to, ...request });
  const sha = decision.status === 'matched' ? decision.sha256 : null;
  const base = {
    ...decisionFields(decision),
    ...choiceFields(where.scope, where.place),
    ...triggerFields(where.triggers),
    model_source: 'hook-input',
    from_model: from || null,
  };
  const state = decision.model === null ? null : { model: decision.model, status: decision.status, sha256: sha };

  // Resuming a session restores its model and reports it as a switch; the rules may already be there.
  if (session !== null && session.model === decision.model && session.sha256 === sha)
    return { record: { ...base, delivered: 'already-delivered', warned: false }, context: null, messages: [], state };

  const previous = session ? session.model : from || null;
  const previousHadRules = session
    ? session.status === 'matched'
    : previous !== null && resolve(config, { model: previous, ...request }).status === 'matched';
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

/** The triggers a session has revealed, for its log line; nothing when it has revealed none. */
function triggerFields(triggers: readonly Trigger[]): Record<string, unknown> {
  return triggers.length ? { triggers } : {};
}

function undeclaredMessages(decision: Decision, file: string, launch: LaunchModel | null = null): string[] {
  if (decision.status !== 'undeclared' || decision.warning === undefined) return [];
  if (decision.reason !== 'model-not-reported')
    return [
      `noonsight: ${decision.model} is not declared in ${file}, so this session gets no rules. ` +
        'Declare it under "models" (with "use": "none" if it needs no rules).',
    ];
  if (launch?.kind === 'unresolved')
    return [
      `noonsight: this session's model is set to "${launch.value}" (${launch.from}), and noonsight cannot tell which model that is ` +
        `(${launch.why}), so no rules were delivered.`,
    ];
  return [
    "noonsight: Claude Code did not report this session's model, and neither its command line, ANTHROPIC_MODEL nor a model setting names one, " +
      'so no rules were delivered.',
  ];
}

function output(messages: readonly string[], specific: Record<string, unknown> | null): string {
  if (!specific && messages.length === 0) return '';
  return JSON.stringify({
    ...(messages.length ? { systemMessage: messages.join('\n') } : {}),
    ...(specific ? { hookSpecificOutput: specific } : {}),
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

function once<T>(read: () => T): () => T {
  let cached: { value: T } | null = null;
  return () => (cached ??= { value: read() }).value;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
