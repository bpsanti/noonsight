// The Claude Code hook adapter: SessionStart and PostModelSwitch for the session itself, PostToolUse
// on Edit and Write for the triggers the session reveals (triggers.ts), and PreToolUse and PostToolUse
// on the agent tool and SubagentStart for the subagents it starts (subagents.ts).
//
// Contract (docs/hooks.md has the full table):
//   - Always exits 0 and never holds the session beyond a bound: it reads local files only and never
//     the network itself. It starts no process, except `ps` on macOS to read the Claude Code command
//     line when the input does not name the session's model and, except at a resume, no record does
//     (launch.ts), or when `noonsight run` started the session (launcher.ts); `git ls-files`, stopped
//     after 3 seconds, for an edit of a code file until the session reveals code-edit (code-edit.ts);
//     and, with classifier.mode on, the classifier for an agent call, stopped after
//     classifier.timeout_ms (classifier.ts).
//   - Prints nothing, or one JSON object: hookSpecificOutput for Claude Code (session or subagent
//     context, or a subagent call routing changed), systemMessage for the person.
//   - Writes one line to the decision log for every decision it makes.
//   - A configuration with any problem is refused whole: nothing is delivered, the person is warned,
//     and the log records config-invalid.

import fs from 'node:fs';
import { ConfigError, loadConfigDetails, type ConfigDetails } from '../../config/load.js';
import { changesDelivery, comparePresets, describeChanges } from '../../config/preset-changes.js';
import { configPath, stateDir, type Env } from '../../config/paths.js';
import { projectFields, projectFor, projectWarning } from '../../config/project.js';
import { normalizeModel } from '../../core/normalize.js';
import { joinDelivery, launcherNote, resolve, resolveAdded, switchNote } from '../../core/resolve.js';
import { sessionPlace, sessionScope, type PlaceChoice, type ScopeChoice } from '../../core/scope.js';
import type { Config, Decision, Trigger } from '../../core/types.js';
import { appendDecision } from '../../state/log.js';
import { heldModels, processFile, pruneState, readState, sessionFile, writeState, type DeliveryState } from '../../state/sessions.js';
import { sessionTriggers } from '../../state/triggers.js';
import { launchFields, launchModel, readCommandLine, type LaunchModel, type LaunchSources } from './launch.js';
import { launcherPrompt, type LauncherPrompt } from './launcher.js';
import type { InstallKind } from './locations.js';
import { conversationResponse, type Response } from './predict.js';
import { HOOK_HANDLERS } from './settings.js';
import { notRouted } from './routing.js';
import { agentCall, agentResult, choiceFields, decisionFields, subagentStart } from './subagents.js';
import { fileEdit, mayReveal } from './triggers.js';

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
    // The session's project: the directory Claude Code names for its hooks, else the input's cwd.
    const project = projectFor(ctx.env.CLAUDE_PROJECT_DIR || str(input.cwd), file, state);
    let details: ConfigDetails;
    try {
      details = loadConfigDetails(file, { project }, ctx.env);
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
    const config = details.config;
    Object.assign(record, projectFields(details.project));
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
          // The conversation still holds what it held, and a delivery that may have been lost stays so.
          const before = readState(sessionState);
          const held = [...new Set([...heldModels(before), ...heldModels(outcome.state)])];
          writeState(sessionState, {
            ...outcome.state,
            held,
            ...(before?.unconfirmed !== undefined ? { unconfirmed: before.unconfirmed } : {}),
            // A resume's delivery is confirmed by a response after it, so its time is kept.
            at: before?.unconfirmed === 'resume' ? before.at : ctx.now.toISOString(),
          });
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
      triggers: sessionTriggers(state, str(input.session_id)),
    };
    const commandLine = once(() => readCommandLine(ctx.parentPid, process.platform));
    const response = once(() => conversationResponse(str(input.transcript_path)));
    const result =
      event === 'SessionStart'
        ? sessionStart(
            input,
            config,
            file,
            where,
            readState(sessionState),
            readState(processState),
            (sources) => launchModel({ env: ctx.env, home: ctx.home, pid: ctx.parentPid, cwd: str(input.cwd), commandLine }, sources),
            response,
            () => launcherPrompt(ctx.env, commandLine),
          )
        : modelSwitch(input, config, file, where, readState(sessionState));
    const startup = event === 'SessionStart' && input.source === 'startup';
    const update = startup ? presetUpdate(details, result.state?.model ?? null, file, ctx.env) : null;
    if (update !== null) {
      result.record.preset_update = update.fields;
      result.record.warned = true;
    }
    // A project left out is reported once, as the session starts.
    const projectNote = startup ? projectWarning(details.project) : null;
    if (projectNote !== null) result.record.warned = true;
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
    return output(
      [...result.messages, ...(update !== null ? [update.message] : []), ...(projectNote !== null ? [projectNote] : [])],
      result.context ? { hookEventName: event, additionalContext: result.context } : null,
    );
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
 *   resume, fork    deliver only when the model or the rules changed since this session's record, or
 *                   when its last delivery may never have arrived: a /model switch's, or a resume's
 *                   the conversation has not answered since
 *   anything else   deliver: delivering twice costs little, missing a delivery is the defect
 *
 * The model comes from the input. When Claude Code leaves it out, after /clear and compaction it comes
 * from the record of the same session or of the same Claude Code process, which keeps the model a
 * /model since the launch chose; and when neither knows it, as in every `claude -p` run, from what the
 * session was started with (launch.ts). A resumed or forked conversation runs in a new Claude Code
 * process, which takes its model from --model, else ANTHROPIC_MODEL, else the model of the
 * conversation's last response since its last compaction, else the model setting; so there those come
 * first, in that order, and the session's record after them. When the model is not the one the record
 * holds, the conversation still holds that model's rules, and as at a /model switch a note says they no
 * longer apply.
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
  readLaunch: (sources: LaunchSources) => LaunchModel,
  readConversation: () => Response | null,
  readLauncher: () => LauncherPrompt | null,
): Outcome {
  const source = str(input.source);
  const resumed = source === 'resume' || source === 'fork';
  const reported = normalizeModel(str(input.model));
  const recorded = session?.model ?? (source === 'clear' || source === 'compact' ? process?.model : null) ?? null;
  const chosen: ModelChoice = reported
    ? { model: reported, source: 'hook-input', launch: null }
    : resumed
      ? resumedModel(recorded, readLaunch, () => readConversation()?.model ?? null)
      : recorded
        ? { model: recorded, source: session?.model ? 'session-record' : 'process-record', launch: null }
        : launchChoice(readLaunch('all'), null);
  const { model, launch } = chosen;
  const request = { model, scope: where.scope.scope, place: where.place.place, triggers: where.triggers };
  const decision = resolve(config, request);
  const sha = decision.status === 'matched' ? decision.sha256 : null;
  const record = resumed && session !== null ? confirmed(session, readConversation) : session;
  // A delivery that may never have reached the conversation is made again.
  const unconfirmed = resumed && record?.unconfirmed !== undefined;
  const repeat = resumed && record !== null && !unconfirmed && record.model === decision.model && record.sha256 === sha;
  // A resumed conversation still holds the rules it held; those of another model no longer apply.
  const kept = resumed ? heldModels(record) : [];
  const retired = repeat || decision.model === null ? [] : kept.filter((m) => m !== decision.model);
  const changedFrom = resumed && record?.model && decision.model !== null && record.model !== decision.model ? record.model : null;

  const launcher = source === 'startup' || source === 'clear' || source === 'compact' ? readLauncher() : null;
  // The launcher's system prompt holds the rules for the session's scope; it never holds those a
  // trigger the session revealed later added, which are delivered here.
  const forLauncher = where.triggers.length ? resolve(config, { ...request, triggers: [] }) : decision;
  const inPrompt = launcher !== null && forLauncher.status === 'matched' && launcher.content.includes(forLauncher.text);
  const added = inPrompt && where.triggers.length ? resolveAdded(config, request, []) : null;
  const sent = inPrompt ? (added?.status === 'matched' ? added : null) : decision.status === 'matched' ? decision : null;
  const otherModel = launcher !== null && !inPrompt && launcher.model !== null && launcher.model !== decision.model ? launcher.model : null;
  const rules = sent !== null && !repeat ? sent.text : null;
  const note = retired.length
    ? switchNote(changedFrom, decision.model ?? '', retired)
    : otherModel !== null
      ? launcherNote(otherModel, decision.model ?? '')
      : null;
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
  // A session start's delivery, once it reaches the conversation, leaves only this model's rules
  // standing: those it delivers or finds, or, when it has none now, those it held before. That of a
  // startup, /clear or compaction is part of the conversation from its start; what a resume or a fork
  // returns reaches it with the process's first request only, so until a response shows it arrived,
  // the conversation may still hold every model's rules it held.
  const holds = decision.model !== null && (decision.status === 'matched' || kept.includes(decision.model));
  const own = holds ? [decision.model as string] : [];
  const pending = resumed && parts.length > 0;
  const held = repeat ? kept : pending ? [...new Set([...kept, ...own])] : own;
  return {
    record: {
      // Rules sent beside the launcher's are only those a trigger added, so the line names those.
      ...decisionFields(sent !== null && sent !== decision && !repeat ? sent : decision),
      ...choiceFields(where.scope, where.place),
      ...triggerFields(where.triggers),
      model_source: chosen.source,
      ...(changedFrom !== null ? { from_model: changedFrom } : {}),
      ...launchFields(launch),
      ...(launcher !== null ? { launch_file: launcher.file, launch_model: launcher.model } : {}),
      delivered: repeat ? 'already-delivered' : rules ? (note ? 'rules+note' : 'rules') : inPrompt ? 'launcher' : note ? 'note' : 'nothing',
      warned: messages.length > 0,
    },
    context: parts.length ? joinDelivery(parts) : null,
    messages,
    state: decision.model === null ? null : { model: decision.model, status: decision.status, sha256: sha, held, ...(pending ? { unconfirmed: 'resume' as const } : {}) },
  };
}

/**
 * A resumed conversation's record as the conversation stands. A resume's delivery goes with the first
 * request its process sends, so when the conversation has answered since that delivery, it arrived,
 * and its note left only the record's model's rules standing. Otherwise the record stands as written.
 */
function confirmed(session: DeliveryState, readConversation: () => Response | null): DeliveryState {
  if (session.unconfirmed !== 'resume') return session;
  const delivered = Date.parse(session.at);
  const answered = readConversation()?.at ?? null;
  if (answered === null || Number.isNaN(delivered) || answered <= delivered) return session;
  const { unconfirmed: _, ...rest } = session;
  return { ...rest, held: heldModels(session).filter((m) => m === session.model) };
}

/** The session's model, where it came from, and the launch setting read for it, for the log line. */
interface ModelChoice {
  readonly model: string | null;
  readonly source: string | null;
  readonly launch: LaunchModel | null;
}

function launchChoice(launch: LaunchModel, fallback: { model: string; source: string } | null): ModelChoice {
  if (launch.kind === 'found') return { model: launch.model, source: launch.source, launch };
  return { model: fallback?.model ?? null, source: fallback?.source ?? null, launch };
}

/**
 * The model of a resumed or forked conversation, which Claude Code reports no model for, in the order
 * Claude Code itself takes it: --model, else ANTHROPIC_MODEL, else the model of the conversation's
 * last response since its last compaction, else the model setting. A value noonsight cannot tell
 * which model it selects leaves the conversation to decide, and below the setting the session's record
 * does: Claude Code then runs its default model, which noonsight cannot tell either.
 *
 * One setting outranks the conversation: `haiku`, over a last response from Haiku or Sonnet
 * (keepsHaikuSetting).
 */
function resumedModel(recorded: string | null, readLaunch: (sources: LaunchSources) => LaunchModel, readConversation: () => string | null): ModelChoice {
  const explicit = readLaunch('explicit');
  if (explicit.kind === 'found') return launchChoice(explicit, null);
  // An explicit value noonsight cannot pin down outranks the setting, as it does in Claude Code.
  const settings = explicit.kind === 'none' ? readLaunch('settings') : explicit;
  const conversation = readConversation();
  if (conversation !== null && !keepsHaikuSetting(settings, conversation))
    return { model: conversation, source: 'session-transcript', launch: explicit.kind === 'none' ? null : explicit };
  if (settings.kind === 'found') return launchChoice(settings, null);
  return launchChoice(settings, recorded !== null ? { model: recorded, source: 'session-record' } : null);
}

/**
 * Whether Claude Code resumes on the model setting rather than on the conversation's last response:
 * it does when the setting is exactly `haiku` and that response came from Haiku or Sonnet. Under any
 * other setting, `opusplan` and `Haiku` included, and under `haiku` after a response from Opus or
 * Fable, the conversation keeps its own model (docs/hooks.md, "SessionStart").
 */
function keepsHaikuSetting(settings: LaunchModel, conversation: string): boolean {
  return settings.kind === 'found' && settings.source === 'settings' && settings.alias === 'haiku' && (conversation.includes('haiku') || conversation.includes('sonnet'));
}

/**
 * PostModelSwitch: deliver the new model's rules. The rules delivered for earlier models stay in the
 * conversation, so when the conversation may hold any, a note says they no longer apply. Claude Code
 * adds what this hook returns to the next request only, and loses it when another switch or the end
 * of the session comes first, so a switch's delivery stays unconfirmed: the next switch's note again
 * names every model whose rules the conversation may hold, and the next resume delivers again.
 */
function modelSwitch(input: Record<string, unknown>, config: Config, file: string, where: Where, session: DeliveryState | null): Outcome {
  const to = normalizeModel(str(input.to_model));
  const from = normalizeModel(str(input.from_model));
  const request = { scope: where.scope.scope, place: where.place.place, triggers: where.triggers };
  const decision = resolve(config, { model: to, ...request });
  const sha = decision.status === 'matched' ? decision.sha256 : null;
  // A switch right after a delivery that may have been lost makes it again.
  const unconfirmed = session?.unconfirmed !== undefined;
  const base = {
    ...decisionFields(decision),
    ...choiceFields(where.scope, where.place),
    ...triggerFields(where.triggers),
    model_source: 'hook-input',
    from_model: from || null,
  };
  // Without a record, the previous model's rules are those the conversation may hold.
  const kept = session
    ? heldModels(session)
    : from && resolve(config, { model: from, ...request }).status === 'matched'
      ? [from]
      : [];
  const held = [...new Set([...kept, ...(decision.status === 'matched' && decision.model !== null ? [decision.model] : [])])];

  // Resuming a session restores its model and reports it as a switch; the rules may already be there.
  if (session !== null && !unconfirmed && session.model === decision.model && session.sha256 === sha)
    return {
      record: { ...base, delivered: 'already-delivered', warned: false },
      context: null,
      messages: [],
      state: decision.model === null ? null : { model: decision.model, status: decision.status, sha256: sha, held },
    };

  const retired = kept.filter((m) => m !== decision.model);
  const note = retired.length ? switchNote(from || session?.model || null, to, retired) : null;
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
    state: decision.model === null ? null : { model: decision.model, status: decision.status, sha256: sha, held, ...(parts.length ? { unconfirmed: 'switch' as const } : {}) },
  };
}

/**
 * The warning a session gets as it starts when the installed preset is not the version the
 * configuration accepted and that changes the session's model's rules: under "warn", what the
 * session receives now that it did not; under "hold", what accepting the installed version would
 * change. A failure here never costs the session its rules: `noonsight check` reports it.
 */
function presetUpdate(
  details: ConfigDetails,
  model: string | null,
  file: string,
  env: Env,
): { message: string; fields: Record<string, unknown> } | null {
  const v = details.presetVersions;
  if (model === null || v.accepted === null || v.installed === null || v.accepted === v.installed.version) return null;
  try {
    const c = comparePresets(v, details.declared, {}, env, model);
    const changes = c?.models[0];
    if (!c || c.from === null || changes === undefined || !changesDelivery(changes)) return null;
    const to = c.installed.version;
    const what = describeChanges(changes, c.held);
    const message = c.held
      ? `noonsight: preset ${c.name} ${to} is installed, and this session keeps the rules of ${c.accepted}, held in ${file}; ` +
        `${to} would change those of ${model}: ${what}. Run \`noonsight accept\` to take ${to}.`
      : `noonsight: preset ${c.name} ${to} changed the rules of ${model} since ${c.accepted}, the version accepted in ${file}: ${what}. ` +
        `Run \`noonsight check\` for every model, and \`noonsight accept\` to accept ${to}.`;
    return { message, fields: { accepted: c.accepted, installed: to, held: c.held } };
  } catch {
    return null;
  }
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
