// The Claude Code hook adapter: SessionStart and PostModelSwitch for the session itself, PostToolUse
// on Edit and Write for the triggers the session reveals (triggers.ts), and PreToolUse, PermissionRequest
// and PostToolUse on the agent tool and SubagentStart for the subagents it starts (subagents.ts).
//
// Contract (docs/hooks.md has the full table):
//   - Always exits 0 and never holds the session beyond a bound: it reads local files only and never
//     the network itself. It starts no process, except `ps` on macOS to read the Claude Code command
//     line when the input does not name the session's model and, except at a resume, no record does
//     (launch.ts), when `noonsight run` started the session (launcher.ts), or when an agent call's
//     subagent may take its model from a definition (definitions.ts); `git ls-files`, stopped
//     after 3 seconds, for an edit of a code file until the session reveals code-edit (code-edit.ts);
//     and, with classifier.mode on, the classifier for an agent call, stopped after
//     classifier.timeout_ms (classifier.ts).
//   - Prints nothing, or one JSON object: hookSpecificOutput for Claude Code (session or subagent
//     context, or a subagent call routing changed), systemMessage for the person.
//   - Writes one line to the decision log for every decision it makes.
//   - A configuration with any problem is refused whole: nothing is delivered, the person is warned,
//     and the log records config-invalid.
import fs from 'node:fs';
import { writeConfig } from '../../config/create.js';
import { ConfigError, loadConfigDetails } from '../../config/load.js';
import { changesDelivery, comparePresets, describeChanges } from '../../config/preset-changes.js';
import { configPath, stateDir } from '../../config/paths.js';
import { projectFields, projectFor, projectWarning } from '../../config/project.js';
import { normalizeModel } from '../../core/normalize.js';
import { joinDelivery, launcherNote, resolve, resolveAdded, stampDelivery, switchNote } from '../../core/resolve.js';
import { sessionPlace, sessionScope } from '../../core/scope.js';
import { ANY_MODEL } from '../../core/types.js';
import { claimOccurrence } from '../../state/claims.js';
import { appendDecision } from '../../state/log.js';
import { heldModels, processFile, pruneState, readState, sessionFile, writeState } from '../../state/sessions.js';
import { forPlugin } from '../../wording.js';
import { inheritTriggers, sessionTriggers } from '../../state/triggers.js';
import { forkOrigin } from './fork.js';
import { launchFields, launchModel, readCommandLine, resolveModelValue, resolveValue } from './launch.js';
import { launcherPrompt } from './launcher.js';
import { conversationResponse } from './predict.js';
import { HOOK_HANDLERS } from './settings.js';
import { notRouted } from './routing.js';
import { agentCall, agentHeld, agentResult, choiceFields, decisionFields, lateRules, subagentStart } from './subagents.js';
import { fileEdit, mayReveal } from './triggers.js';
/**
 * Run one hook event. Returns what to print on stdout (possibly nothing). Never throws. When another
 * kind of install runs the same event, only the copy that claims it runs (state/claims.ts).
 */
export function runHook(arg, rawInput, ctx) {
    const out = runEvent(arg, rawInput, ctx, true);
    return ctx.install === 'plugin' ? withMessages(out, forPlugin) : out;
}
/** `late` is false only for the event's own run after rules a subagent was owed have been given (see below). */
function runEvent(arg, rawInput, ctx, late) {
    if (ctx.env.NOONSIGHT_DISABLE === '1')
        return '';
    const spec = HOOK_HANDLERS.find((h) => h.arg === arg);
    if (!spec)
        return '';
    const event = spec.event;
    const input = parseInput(rawInput);
    // Anything that is not this Claude Code event (another tool reading the same settings, a hand
    // run, a renamed event) is left alone, silently.
    if (!input || input.hook_event_name !== event)
        return '';
    const toolEvent = spec.tools !== undefined;
    const editEvent = arg === 'file-edit';
    const subagentEvent = (toolEvent && !editEvent) || event === 'SubagentStart';
    // Each settings entry only matches its own tools; a hand-edited or widened matcher must not reach other tools.
    if (spec.tools !== undefined && !spec.tools.includes(str(input.tool_name) ?? ''))
        return '';
    const state = stateDir(ctx.home);
    const record = {
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
    const log = (fields) => {
        try {
            appendDecision(state, { ...record, ...fields });
        }
        catch {
            // A log that cannot be written must not cost the session its rules.
        }
    };
    // A machine-wide install reaches every account; an account that never set noonsight up is left alone.
    // Installing the plugin is setting it up, so the first session that starts under it writes the
    // configuration, as `noonsight install` does.
    const unset = isUnset(ctx);
    if (unset && !(ctx.install === 'plugin' && event === 'SessionStart'))
        return '';
    // Claimed only by a copy that will run: one that returned above left the event to another install.
    const claimed = once(() => !late || ctx.install === null || claimOccurrence(state, ctx.install, { event: arg, parentPid: ctx.parentPid, input: rawInput }, ctx.now.getTime()));
    // A result or an edit inside a subagent whose start could not tell its call: the subagent's own call is
    // known by now, and its rules ride on this hook's context. The event itself then runs as usual, and
    // its own output is added.
    if (late && (arg === 'agent-result' || editEvent) && str(input.agent_id) !== null) {
        if (!claimed())
            return '';
        let owed = null;
        try {
            owed = lateRules(input, { state, now: ctx.now });
        }
        catch {
            // The subagent keeps going without them, as it started.
        }
        if (owed !== null) {
            log(owed.record);
            return withContext(runEvent(arg, rawInput, ctx, false), event, String(owed.specific?.additionalContext ?? ''));
        }
    }
    // Every edit runs this hook; one that cannot reveal a trigger ends here, before the configuration is read.
    if (editEvent && !mayReveal(input, state))
        return '';
    if (!claimed())
        return '';
    try {
        const file = configPath(ctx.env, ctx.home);
        record.config = file;
        const wrote = unset ? writeConfig(ctx.env, ctx.home) : null;
        if (wrote !== null)
            record.config_written = true;
        // The session's project: the directory Claude Code names for its hooks, else the input's cwd.
        const project = projectFor(ctx.env.CLAUDE_PROJECT_DIR || str(input.cwd), file, state);
        let details;
        try {
            details = loadConfigDetails(file, { project }, ctx.env);
        }
        catch (e) {
            if (!(e instanceof ConfigError))
                throw e;
            // The call that started the subagent already warned, and logged that nothing was delivered; the
            // session's start already warned that the session got no rules; the call a permission prompt holds
            // already warned.
            if (event === 'SubagentStart' || event === 'PermissionRequest' || editEvent)
                return '';
            // The call this result belongs to already warned.
            if (event === 'PostToolUse') {
                log({ status: 'config-invalid', problems: e.problems.length, ...notRouted('config-invalid'), warned: false });
                return '';
            }
            log({ status: 'config-invalid', problems: e.problems.length, ...(event === 'PreToolUse' ? notRouted('config-invalid') : {}), delivered: 'nothing', warned: true });
            return output([
                `noonsight: the configuration at ${file} was refused (${plural(e.problems.length, 'problem')}), ` +
                    'so no rules were delivered. Run `noonsight check` to see the problems.',
            ], null);
        }
        const config = details.config;
        Object.assign(record, projectFields(details.project));
        if (subagentEvent) {
            const sub = { env: ctx.env, home: ctx.home, now: ctx.now, state, parentPid: ctx.parentPid, file };
            const outcome = event === 'PreToolUse'
                ? agentCall(input, config, sub)
                : event === 'SubagentStart'
                    ? subagentStart(input, config, sub)
                    : event === 'PermissionRequest'
                        ? agentHeld(input, config, sub)
                        : agentResult(input, config, sub);
            if (outcome === null)
                return '';
            log(outcome.record);
            return output(outcome.messages, outcome.specific);
        }
        const sessionId = str(input.session_id) ?? '';
        const sessionState = sessionFile(state, sessionId);
        if (editEvent) {
            const outcome = fileEdit(input, config, { env: ctx.env, home: ctx.home, now: ctx.now, state, parentPid: ctx.parentPid });
            if (outcome === null)
                return '';
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
                        ...(before?.chosen !== undefined ? { chosen: before.chosen } : {}),
                        // A resume's delivery is confirmed by a response after it, so its time is kept.
                        at: before?.unconfirmed === 'resume' ? before.at : ctx.now.toISOString(),
                    });
                }
                catch {
                    // Without the record, a later resume delivers again: the safe direction.
                }
            return output([], outcome.context ? { hookEventName: event, additionalContext: outcome.context } : null);
        }
        const processState = processFile(state, ctx.parentPid);
        const commandLine = once(() => readCommandLine(ctx.parentPid, process.platform));
        const own = readState(sessionState);
        // A fork starts with a copy of another conversation under a new id that has no record (fork.ts).
        const fork = event === 'SessionStart' && str(input.source) === 'fork' && own === null ? forkContext(input, state, ctx.env, commandLine) : null;
        if (fork?.origin)
            inheritTriggers(state, fork.origin.sessionId, sessionId);
        // Both come from the environment Claude Code runs in, which its hooks inherit.
        const where = {
            scope: sessionScope(ctx.env),
            place: sessionPlace(config, ctx.env),
            triggers: sessionTriggers(state, str(input.session_id)),
        };
        const response = once(() => conversationResponse(str(input.transcript_path)));
        const result = event === 'SessionStart'
            ? sessionStart(input, config, file, where, own, readState(processState), (sources) => launchModel({ env: ctx.env, home: ctx.home, pid: ctx.parentPid, cwd: str(input.cwd), commandLine }, sources), response, () => launcherPrompt(ctx.env, commandLine), fork)
            : modelSwitch(input, config, file, where, readState(sessionState), ctx.env);
        const startup = event === 'SessionStart' && input.source === 'startup';
        const update = startup ? presetUpdate(details, result.state?.model ?? null, file, ctx.env) : null;
        if (update !== null) {
            result.record.preset_update = update.fields;
            result.record.warned = true;
        }
        // A project left out is reported once, as the session starts.
        const projectNote = startup ? projectWarning(details.project) : null;
        if (projectNote !== null)
            result.record.warned = true;
        if (wrote !== null)
            result.record.warned = true;
        log(result.record);
        if (result.state) {
            const saved = { ...result.state, at: ctx.now.toISOString() };
            try {
                writeState(sessionState, saved);
                writeState(processState, saved);
                if (event === 'SessionStart' && input.source === 'startup')
                    pruneState(state, ctx.now.getTime());
            }
            catch {
                // Without the record, a later resume delivers again: the safe direction.
            }
        }
        // Claude Code leaves out a resume's or a fork's context when an earlier start of the conversation
        // added the same text, so each such delivery carries its time (docs/hooks.md, "SessionStart").
        const resumedStart = event === 'SessionStart' && (input.source === 'resume' || input.source === 'fork');
        const context = result.context !== null && resumedStart ? stampDelivery(result.context, ctx.now.toISOString()) : result.context;
        return output([...(wrote !== null ? [firstConfigMessage(file)] : []), ...result.messages, ...(update !== null ? [update.message] : []), ...(projectNote !== null ? [projectNote] : [])], context ? { hookEventName: event, additionalContext: context } : null);
    }
    catch (e) {
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
        // A permission request is answered by the person; the call it holds may then start too late for its rules.
        if (event === 'PermissionRequest') {
            log({ status: 'error', error: message, warned: false });
            return '';
        }
        if (event === 'SubagentStart') {
            log({ status: 'error', error: message, delivered: 'nothing', warned: true });
            return output([`noonsight: the hook failed (${message}), so the subagent that started got no rules.`], null);
        }
        log({ status: 'error', error: message, ...(event === 'PreToolUse' ? notRouted('error') : {}), delivered: 'nothing', warned: true });
        return output([`noonsight: the hook failed (${message}), so no rules were delivered.`], null);
    }
}
function forkContext(input, state, env, commandLine) {
    const origin = forkOrigin(str(input.transcript_path), env, commandLine);
    return {
        origin,
        record: origin !== null ? readState(sessionFile(state, origin.sessionId)) : null,
        response: once(() => conversationResponse(origin?.transcript ?? null)),
        launch: origin?.model !== undefined ? resolveValue(origin.model, 'claude-args', '--model of the background job', env) : null,
    };
}
/**
 * The record of a conversation nothing is known of: it may hold the rules of any model, so the next
 * delivery says that those of every model but the session's own no longer apply.
 */
const UNKNOWN_HELD = { model: null, status: 'none', sha256: null, held: [ANY_MODEL], at: new Date(0).toISOString() };
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
function sessionStart(input, config, file, where, session, process, readLaunch, ownConversation, readLauncher, fork = null) {
    const source = str(input.source);
    const resumed = source === 'resume' || source === 'fork';
    // A fork's own id has no record yet: the conversation it copied stands in for it, as that
    // conversation's record and last response; with nothing known of it, it may hold any model's rules.
    const known = fork !== null ? (fork.record ?? UNKNOWN_HELD) : session;
    const readConversation = fork !== null ? () => ownConversation() ?? fork.response() : ownConversation;
    // A background job runs on the model it was started with, which its own command line does not show.
    const readStart = fork?.launch ? (sources) => (sources === 'settings' ? readLaunch(sources) : fork.launch) : readLaunch;
    const reported = normalizeModel(str(input.model));
    const recorded = known?.model ?? (source === 'clear' || source === 'compact' ? process?.model : null) ?? null;
    // Claude Code may run another model in place of the one the person chose, as it runs Sonnet in plan
    // mode for Haiku; the start of a compaction, /resume or /branch in that process then reports the
    // chosen model, and the process keeps running the other, so the record of the same process, which
    // the switch to it wrote, decides. A resume or fork that reports a model runs in the same process;
    // one in a new process reports none, and a new process starts on the model it is given.
    const sameProcess = source === 'compact' || source === 'clear' || (resumed && !!reported);
    const carried = sameProcess ? (process ?? (source === 'compact' ? known : null)) : null;
    const substituted = carried?.chosen !== undefined && carried.model !== null && (!reported || reported === carried.chosen) ? carried : null;
    const chosen = substituted
        ? { model: substituted.model, source: substituted === process ? 'process-record' : 'session-record', launch: null }
        : reported
            ? { model: reported, source: 'hook-input', launch: null }
            : resumed
                ? resumedModel(recorded, readStart, () => readConversation()?.model ?? null)
                : recorded
                    ? { model: recorded, source: session?.model ? 'session-record' : 'process-record', launch: null }
                    : launchChoice(readLaunch('all'), null);
    const { model, launch } = chosen;
    const request = { model, scope: where.scope.scope, place: where.place.place, triggers: where.triggers };
    const decision = resolve(config, request);
    const sha = decision.status === 'matched' ? decision.sha256 : null;
    const record = resumed && known !== null ? confirmed(known, fork !== null ? fork.response : readConversation) : known;
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
    const own = holds ? [decision.model] : [];
    const pending = resumed && parts.length > 0;
    const held = repeat ? kept : pending ? [...new Set([...kept, ...own])] : own;
    return {
        record: {
            // Rules sent beside the launcher's are only those a trigger added, so the line names those.
            ...decisionFields(sent !== null && sent !== decision && !repeat ? sent : decision),
            ...choiceFields(where.scope, where.place),
            ...triggerFields(where.triggers),
            model_source: chosen.source,
            ...(substituted !== null ? { chosen_model: substituted.chosen, ...(reported ? { reported_model: reported } : {}) } : {}),
            ...(fork !== null ? { fork_origin: fork.origin?.via ?? 'unknown', ...(fork.origin !== null ? { forked_from: fork.origin.sessionId } : {}) } : {}),
            ...(changedFrom !== null ? { from_model: changedFrom } : {}),
            ...launchFields(launch),
            ...(launcher !== null ? { launch_file: launcher.file, launch_model: launcher.model } : {}),
            delivered: repeat ? 'already-delivered' : rules ? (note ? 'rules+note' : 'rules') : inPrompt ? 'launcher' : note ? 'note' : 'nothing',
            warned: messages.length > 0,
        },
        context: parts.length ? joinDelivery(parts) : null,
        messages,
        state: decision.model === null
            ? null
            : { model: decision.model, status: decision.status, sha256: sha, held, ...(pending ? { unconfirmed: 'resume' } : {}), ...(substituted?.chosen ? { chosen: substituted.chosen } : {}) },
    };
}
/**
 * A resumed conversation's record as the conversation stands. A resume's delivery goes with the first
 * request its process sends, so when the conversation has answered since that delivery, it arrived,
 * and its note left only the record's model's rules standing. Otherwise the record stands as written.
 */
function confirmed(session, readConversation) {
    if (session.unconfirmed !== 'resume')
        return session;
    const delivered = Date.parse(session.at);
    const answered = readConversation()?.at ?? null;
    if (answered === null || Number.isNaN(delivered) || answered <= delivered)
        return session;
    const { unconfirmed: _, ...rest } = session;
    return { ...rest, held: heldModels(session).filter((m) => m === session.model) };
}
function launchChoice(launch, fallback) {
    if (launch.kind === 'found')
        return { model: launch.model, source: launch.source, launch };
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
function resumedModel(recorded, readLaunch, readConversation) {
    const explicit = readLaunch('explicit');
    if (explicit.kind === 'found')
        return launchChoice(explicit, null);
    // An explicit value noonsight cannot pin down outranks the setting, as it does in Claude Code.
    const settings = explicit.kind === 'none' ? readLaunch('settings') : explicit;
    const conversation = readConversation();
    if (conversation !== null && !keepsHaikuSetting(settings, conversation))
        return { model: conversation, source: 'session-transcript', launch: explicit.kind === 'none' ? null : explicit };
    if (settings.kind === 'found')
        return launchChoice(settings, null);
    return launchChoice(settings, recorded !== null ? { model: recorded, source: 'session-record' } : null);
}
/**
 * Whether Claude Code resumes on the model setting rather than on the conversation's last response:
 * it does when the setting is exactly `haiku` and that response came from Haiku or Sonnet. Under any
 * other setting, `opusplan` and `Haiku` included, and under `haiku` after a response from Opus or
 * Fable, the conversation keeps its own model (docs/hooks.md, "SessionStart").
 */
function keepsHaikuSetting(settings, conversation) {
    return settings.kind === 'found' && settings.source === 'settings' && settings.alias === 'haiku' && (conversation.includes('haiku') || conversation.includes('sonnet'));
}
/**
 * PostModelSwitch: deliver the new model's rules. The rules delivered for earlier models stay in the
 * conversation, so when the conversation may hold any, a note says they no longer apply. Claude Code
 * adds what this hook returns to the next request only, and loses it when another switch or the end
 * of the session comes first, so a switch's delivery stays unconfirmed: the next switch's note again
 * names every model whose rules the conversation may hold, and the next resume delivers again.
 */
function modelSwitch(input, config, file, where, session, env) {
    const to = normalizeModel(str(input.to_model));
    const from = normalizeModel(str(input.from_model));
    const chosen = chosenModel(input, from, to, session, env);
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
        ...(chosen !== null ? { chosen_model: chosen } : {}),
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
            state: decision.model === null ? null : { model: decision.model, status: decision.status, sha256: sha, held, ...(chosen !== null ? { chosen } : {}) },
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
        state: decision.model === null
            ? null
            : { model: decision.model, status: decision.status, sha256: sha, held, ...(parts.length ? { unconfirmed: 'switch' } : {}), ...(chosen !== null ? { chosen } : {}) },
    };
}
/**
 * The model the person chose, when the switch leaves Claude Code running another in its place, else
 * null. A switch Claude Code makes by itself (`source: "auto"`, as when plan mode on Haiku runs Sonnet)
 * keeps the model chosen before it, until a switch back to that model; a `/model` whose
 * `requested_model` selects another model than the one it switched to was substituted the same way.
 */
function chosenModel(input, from, to, session, env) {
    if (str(input.source) === 'auto') {
        const before = session?.chosen ?? (from || null);
        return before !== null && before !== to ? before : null;
    }
    const requested = str(input.requested_model);
    const asked = requested !== null ? resolveModelValue(requested, env) : null;
    return asked?.kind === 'found' && asked.model !== to ? asked.model : null;
}
/**
 * The warning a session gets as it starts when the installed preset is not the version the
 * configuration accepted and that changes the session's model's rules: under "warn", what the
 * session receives now that it did not; under "hold", what accepting the installed version would
 * change. A failure here never costs the session its rules: `noonsight check` reports it.
 */
function presetUpdate(details, model, file, env) {
    const v = details.presetVersions;
    if (model === null || v.accepted === null || v.installed === null || v.accepted === v.installed.version)
        return null;
    try {
        const c = comparePresets(v, details.declared, {}, env, model);
        const changes = c?.models[0];
        if (!c || c.from === null || changes === undefined || !changesDelivery(changes))
            return null;
        const to = c.installed.version;
        const what = describeChanges(changes, c.held);
        const message = c.held
            ? `noonsight: preset ${c.name} ${to} is installed, and this session keeps the rules of ${c.accepted}, held in ${file}; ` +
                `${to} would change those of ${model}: ${what}. Run \`noonsight accept\` to take ${to}.`
            : `noonsight: preset ${c.name} ${to} changed the rules of ${model} since ${c.accepted}, the version accepted in ${file}: ${what}. ` +
                `Run \`noonsight check\` for every model, and \`noonsight accept\` to accept ${to}.`;
        return { message, fields: { accepted: c.accepted, installed: to, held: c.held } };
    }
    catch {
        return null;
    }
}
/** The triggers a session has revealed, for its log line; nothing when it has revealed none. */
function triggerFields(triggers) {
    return triggers.length ? { triggers } : {};
}
function undeclaredMessages(decision, file, launch = null) {
    if (decision.status !== 'undeclared' || decision.warning === undefined)
        return [];
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
function output(messages, specific) {
    if (!specific && messages.length === 0)
        return '';
    return JSON.stringify({
        ...(messages.length ? { systemMessage: messages.join('\n') } : {}),
        ...(specific ? { hookSpecificOutput: specific } : {}),
    });
}
/** Whether the account never set noonsight up: no configuration at the default path, and none named. */
function isUnset(ctx) {
    try {
        return !ctx.env.NOONSIGHT_CONFIG && !fs.existsSync(configPath(ctx.env, ctx.home));
    }
    catch {
        // The event's own run meets the failure, and reports it.
        return false;
    }
}
/** What the plugin's first session says once it has written the configuration. */
function firstConfigMessage(file) {
    return (`noonsight: no configuration was found, so ${file} was written from the preset, and sessions and subagents now receive its rules for their model. ` +
        'Run `noonsight check` to see what each model receives and how to change it.');
}
/** A hook's output with each message for the person reworded; its context is left as it is. */
function withMessages(out, word) {
    if (out === '')
        return out;
    const parsed = JSON.parse(out);
    return typeof parsed.systemMessage === 'string' ? JSON.stringify({ ...parsed, systemMessage: word(parsed.systemMessage) }) : out;
}
/** A hook's output with more context added to it, for the event given. */
function withContext(out, event, context) {
    if (context === '')
        return out;
    let parsed = {};
    try {
        if (out !== '')
            parsed = JSON.parse(out);
    }
    catch {
        parsed = {};
    }
    const specific = (typeof parsed.hookSpecificOutput === 'object' && parsed.hookSpecificOutput !== null ? parsed.hookSpecificOutput : {});
    const earlier = typeof specific.additionalContext === 'string' && specific.additionalContext !== '' ? specific.additionalContext : null;
    return JSON.stringify({
        ...parsed,
        hookSpecificOutput: { ...specific, hookEventName: event, additionalContext: earlier === null ? context : `${context}\n\n${earlier}` },
    });
}
function parseInput(raw) {
    try {
        const value = JSON.parse(raw);
        return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
    }
    catch {
        return null;
    }
}
function str(value) {
    return typeof value === 'string' && value !== '' ? value : null;
}
function once(read) {
    let cached = null;
    return () => (cached ??= { value: read() }).value;
}
function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}
//# sourceMappingURL=hook.js.map