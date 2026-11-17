// The Claude Code hook adapter for subagents: PreToolUse and PostToolUse on the agent tool, and
// SubagentStart.
//
//   PreToolUse    predicts the model the subagent will run on (predict.ts) and resolves its rules for
//                 the place "subagent". It records them under the call's tool_use_id, and adds the call
//                 to its session's pool of calls whose subagent has not started. It returns the call
//                 changed, with the permission decision the configuration asks for, only when routing
//                 sets its model or effort; any other call gets no output that touches it, so the auto
//                 mode classifier's review of the response the call came in still holds. With
//                 classifier.mode on, a task its matchers did not place may wait for the classifier
//                 (classifier.ts), up to classifier.timeout_ms.
//   SubagentStart gives the subagent the rules of the call that started it, as additionalContext. Its
//                 input names the subagent and its type but not the call, so it takes the one open call
//                 of that type in the session's pool, or the call whose result already named this
//                 subagent. When several calls of the type are open, it waits briefly for a result to name
//                 it; failing that, the subagent gets only what every one of those calls would give, since
//                 the subagents of one response's calls start in no fixed order.
//   PostToolUse   compares the prediction with the model the subagent started on (resolvedModel in the
//                 tool's response), logs match or MISMATCH, and warns on a mismatch. It records the
//                 subagent's model under its agent id, for the calls that subagent makes in turn, and
//                 which call started that subagent, for a start not seen yet.
//
// Like the session hooks, none ever blocks a call: an undeclared or unknown model only warns.

import { normalizeModel } from '../../core/normalize.js';
import { resolve, scopeChangesRules } from '../../core/resolve.js';
import { route, routeReadsScope, routingGate } from '../../core/route.js';
import { taskScope, taskText, type PlaceChoice, type ScopeChoice } from '../../core/scope.js';
import type { Config, Decision } from '../../core/types.js';
import {
  agentCallFile,
  agentFile,
  agentLinkFile,
  agentStartFile,
  changePool,
  pause,
  readAgentCall,
  readAgentLink,
  readAgentModel,
  readAgentStart,
  removeRecord,
  writeRecord,
  type AgentCall,
  type AgentStart,
  type OpenCall,
  type Pool,
  type SharedGroup,
  type StartMatch,
} from '../../state/agents.js';
import { readState, sessionFile } from '../../state/sessions.js';
import type { Env } from '../../config/paths.js';
import { classifiedScope } from './classifier.js';
import { launchModel } from './launch.js';
import { defaultAccountDir } from './locations.js';
import { definitionFinder, predict, subagentTranscript, transcriptModel, type Definition, type Prediction } from './predict.js';
import { notRouted, routeFields, subagentHeld, subagentTranslation } from './routing.js';

export interface SubagentContext {
  readonly env: Env;
  readonly home: string;
  readonly now: Date;
  readonly state: string;
  readonly parentPid: number;
  /** The configuration file, named in warnings. */
  readonly file: string;
}

export interface SubagentOutcome {
  readonly record: Record<string, unknown>;
  readonly messages: readonly string[];
  /** The hookSpecificOutput to return, or null. */
  readonly specific: Record<string, unknown> | null;
}

/** The model of whoever makes the call, and where it came from. */
interface Parent {
  readonly model: string | null;
  readonly source: string | null;
}

export function agentCall(input: Record<string, unknown>, config: Config, ctx: SubagentContext): SubagentOutcome {
  const toolInput = input.tool_input;
  const callFile = agentCallFile(ctx.state, str(input.tool_use_id));
  if (typeof toolInput !== 'object' || toolInput === null || Array.isArray(toolInput))
    return {
      record: { status: 'error', error: 'the call has no tool_input', ...notRouted('error'), delivered: 'nothing', warned: false },
      messages: [],
      specific: null,
    };
  const ti = toolInput as Record<string, unknown>;
  const subagentType = str(ti.subagent_type) ?? 'general-purpose';
  const requested = str(ti.model);
  const base = { subagent_type: subagentType, requested_model: requested, ...(str(ti.effort) !== null ? { requested_effort: str(ti.effort) } : {}) };

  // With nothing to deliver and nothing to route, the call is left alone without reading anything.
  const gate = routingGate(config, 'subagents', ctx.env);
  if (config.subagents.delivery === 'off' && gate !== null)
    return { record: { ...base, ...routeFields(gate, ctx.env), delivered: 'off', warned: false }, messages: [], specific: null };

  const parent = parentModel(input, ctx);
  const projectDir = ctx.env.CLAUDE_PROJECT_DIR || str(input.cwd);
  const findDefinition = once(definitionFinder({ projectDir, configDir: defaultAccountDir(ctx.env, ctx.home) }));
  const predictWith = (model: string | null): Prediction =>
    predict({ subagentType, requested: model, parent: parent.model, env: ctx.env, findDefinition });
  const prompt = typeof ti.prompt === 'string' ? ti.prompt : null;
  // The route is decided from the model the call would get as it stands, and the rules for the model it
  // gets once routed.
  const asCalled = predictWith(requested);
  const held = subagentHeld(asCalled);
  // The subagent's own task decides its scope; the session's scope does not carry over.
  const task = taskText(str(ti.description), prompt);
  const classified = classifiedScope(config, {
    chosen: taskScope(config, task.text),
    text: task.text,
    matters: () =>
      routeReadsScope(config, { target: 'subagents', env: ctx.env, held }) ||
      (config.subagents.delivery !== 'off' && scopeChangesRules(config, asCalled.model, 'subagent')),
    env: ctx.env,
  });
  const scope = classified.scope;
  const unplaced =
    classified.failure !== null
      ? [`noonsight: the classifier could not place the task of subagent ${subagentType} (${classified.failure}), so it has no scope.`]
      : [];

  const definitionEffort = subagentType.includes(':') ? null : (findDefinition(subagentType)?.effort ?? null);
  const routed = route(config, {
    target: 'subagents',
    scope: scope.scope,
    env: ctx.env,
    held,
    explicitEffort: str(ti.effort) !== null || definitionEffort !== null,
    translate: subagentTranslation((alias) => predictWith(alias).model),
  });
  const changes: Record<string, unknown> =
    routed.routing === 'routed' ? { model: routed.value, ...(routed.effort !== undefined ? { effort: routed.effort } : {}) } : {};
  const routing = routeFields(routed, ctx.env);

  if (config.subagents.delivery === 'off') {
    const specific = Object.keys(changes).length > 0 ? changed(config, { ...ti, ...changes }, changes) : null;
    return {
      record: {
        ...base,
        ...choiceFields(scope),
        ...classified.fields,
        ...routing,
        delivered: 'off',
        ...(specific !== null ? { permission: config.subagents.permission } : {}),
        warned: unplaced.length > 0,
      },
      messages: unplaced,
      specific,
    };
  }

  const prediction = routed.routing === 'routed' ? predictWith(routed.value) : asCalled;
  const decision = resolve(config, { model: prediction.model, scope: scope.scope, place: 'subagent' });

  // The rules are handed to the subagent when it starts, not added to the task text: a changed call
  // costs the other calls of the same response their auto mode review.
  const planned: AgentCall['delivered'] =
    decision.status !== 'matched' ? 'nothing' : prompt !== null && prompt.includes(decision.text) ? 'already-delivered' : 'at-start';
  const specific = Object.keys(changes).length > 0 ? changed(config, { ...ti, ...changes }, changes) : null;

  const call: AgentCall = {
    session_id: str(input.session_id),
    subagent_type: subagentType,
    predicted: decision.model,
    status: decision.status,
    sha256: decision.status === 'matched' ? decision.sha256 : null,
    delivered: planned,
    ...(planned === 'at-start' && decision.status === 'matched' ? { text: decision.text, rules: decision.rules, scope: decision.scope } : {}),
    routing: routed.routing,
    routing_reason: routed.reason,
    at: ctx.now.toISOString(),
  };
  const toolUseId = str(input.tool_use_id);
  const sessionId = str(input.session_id);
  // A call with no rules is recorded too, so that its subagent's start never takes another call's rules.
  let failure: string | null = null;
  try {
    writeRecord(callFile, call);
    if (callFile !== null && toolUseId !== null && sessionId !== null)
      changePool(ctx.state, sessionId, (pool) => ({
        pool: { open: [...pool.open, { id: toolUseId, type: subagentType, at: call.at }], groups: pool.groups },
        value: undefined,
      }));
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e);
  }
  // Without the record, the subagent's start finds no call, so it gets no rules, and its result is not checked.
  const delivered = failure !== null && planned === 'at-start' ? 'nothing' : planned;
  const messages = [
    ...unplaced,
    ...undeclaredMessages(decision, prediction, subagentType, ctx.file),
    ...(failure !== null && planned === 'at-start' ? [`noonsight: noonsight could not record the call of subagent ${subagentType} (${failure}), so it gets no rules.`] : []),
  ];
  return {
    record: {
      ...base,
      parent_model: parent.model,
      parent_source: parent.source,
      ...decisionFields(decision),
      ...choiceFields(scope),
      ...classified.fields,
      ...(task.cut ? { task_text_cut: true } : {}),
      model_source: prediction.source,
      ...(prediction.value !== undefined ? { model_value: prediction.value } : {}),
      ...(prediction.definition !== undefined ? { definition: prediction.definition } : {}),
      ...(prediction.why !== undefined ? { unresolved_why: prediction.why } : {}),
      ...routing,
      delivered,
      ...(failure !== null ? { error: failure } : {}),
      ...(specific !== null ? { permission: config.subagents.permission } : {}),
      warned: messages.length > 0,
    },
    messages,
    specific,
  };
}

/** The hookSpecificOutput for a call routing changed, with the permission decision the configuration asks for. */
function changed(config: Config, updatedInput: Record<string, unknown>, routed: Record<string, unknown>): Record<string, unknown> {
  const permission = config.subagents.permission;
  const set = Object.entries(routed).map(([k, v]) => `${k} ${String(v)}`);
  return {
    hookEventName: 'PreToolUse',
    ...(permission !== 'passthrough'
      ? { permissionDecision: permission, permissionDecisionReason: `noonsight set the subagent's ${set.join(' and ')} from its task scope` }
      : {}),
    updatedInput,
  };
}

/**
 * How long an open call can wait for its subagent to start. A subagent starts within seconds of its
 * call's hook, while a call denied after its hook ran never starts and no hook says so; until it is
 * left out, a later start of its type cannot tell its own call from it.
 */
const OPEN_FOR_MS = 2 * 60 * 1000;
/**
 * How long before the newest open call of its type a call can have been made and still be its sibling.
 * The calls of one response reach their hooks within moments of each other, so an open call made
 * earlier than this came from an earlier response and was denied after its hook ran.
 */
const SIBLING_MS = 5000;
/** How long a start that several open calls could own waits for a result to name it. */
const LINK_WAIT_MS = 2000;
const LINK_POLL_MS = 25;

type Taken = { readonly match: StartMatch; readonly calls: readonly string[] } | null;
type Decided = { readonly taken: NonNullable<Taken>; readonly given: Given } | null;

/**
 * SubagentStart: the rules for the subagent, from the call that started it. A resumed subagent gets
 * the rules of its first start again; Claude Code adds them only when its context no longer holds them.
 */
export function subagentStart(input: Record<string, unknown>, config: Config, ctx: SubagentContext): SubagentOutcome | null {
  const agentId = str(input.agent_id);
  const type = str(input.agent_type);
  const sessionId = str(input.session_id);
  const startFile = agentStartFile(ctx.state, agentId);
  if (agentId === null || type === null || sessionId === null || startFile === null || config.subagents.delivery === 'off') return null;

  const earlier = readAgentStart(startFile);
  if (earlier !== null)
    return {
      record: { agent_type: type, start_match: 'resumed', delivered: earlier.text !== null ? 'already-delivered' : 'nothing', warned: false },
      messages: [],
      specific: earlier.text !== null ? startContext(earlier.text) : null,
    };

  const now = ctx.now.getTime();
  const linkFile = agentLinkFile(ctx.state, agentId);
  // Decides under the pool's lock, and records the start there too, so that a result of the same call,
  // running at the same time, sees either the start or nothing of it.
  const decide = (final: boolean): Decided | 'wait' =>
    changePool<Decided | 'wait'>(ctx.state, sessionId, (found) => {
      const pool = current(found, now);
      const link = readAgentLink(linkFile);
      let taken: Taken | 'wait';
      const candidates = pool.open.filter((c) => c.type === type);
      let next: Pool = pool;
      if (link !== null) {
        taken = { match: 'result', calls: [link.call] };
        next = without(pool, link.call);
      } else if (candidates.length === 0) taken = null;
      else if (candidates.length === 1) {
        const only = candidates[0]?.id as string;
        taken = { match: 'single', calls: [only] };
        next = without(pool, only);
      } else if (!final) taken = 'wait';
      else {
        taken = { match: 'shared', calls: candidates.map((c) => c.id) };
        next = withShared(pool, taken.calls);
      }
      // Nothing taken: the pool stays as recorded; calls too old to start are left out when it is read.
      if (taken === null || taken === 'wait') return { pool: null, value: taken };
      const given = startText(config, taken, ctx.state);
      writeRecord(startFile, {
        session_id: sessionId,
        subagent_type: type,
        match: taken.match,
        calls: taken.calls,
        text: given.text,
        at: ctx.now.toISOString(),
      } satisfies AgentStart);
      // The result of a call that named this subagent has already been checked.
      if (link !== null) {
        removeRecord(agentCallFile(ctx.state, link.call));
        removeRecord(linkFile);
      }
      return { pool: next, value: { taken, given } };
    });

  let decided = decide(false);
  for (const until = Date.now() + LINK_WAIT_MS; decided === 'wait' && Date.now() < until; ) {
    pause(LINK_POLL_MS);
    decided = decide(false);
  }
  if (decided === 'wait') decided = decide(true);
  // No call of this type is open: a subagent noonsight did not see start, such as a teammate.
  if (decided === null || decided === 'wait') return null;

  const { taken, given } = decided;
  return {
    record: {
      agent_type: type,
      start_match: taken.match,
      ...(taken.match === 'shared' ? { calls: taken.calls } : { call_id: taken.calls[0] ?? null }),
      ...given.fields,
      delivered: given.text !== null ? 'rules' : given.delivered,
      warned: false,
    },
    messages: [],
    specific: given.text !== null ? startContext(given.text) : null,
  };
}

function startContext(text: string): Record<string, unknown> {
  return { hookEventName: 'SubagentStart', additionalContext: text };
}

interface Given {
  readonly text: string | null;
  /** What the log records about the rules given. */
  readonly fields: Record<string, unknown>;
  /** The delivered value when no rules are given. */
  readonly delivered: 'nothing' | 'already-delivered';
}

/**
 * The rules a start gives. A start matched with one call gives that call's rules. A shared start gives
 * what every call it could have been would give: their rules when all are the same; when they are for
 * one model but differ by scope, that model's rules for every scope, which each of them holds; and
 * otherwise nothing, so a subagent never gets rules chosen for another subagent.
 */
function startText(config: Config, taken: NonNullable<Taken>, state: string): Given {
  const calls = taken.calls.map((id) => readAgentCall(agentCallFile(state, id)));
  const give = (c: AgentCall | null): string | null => (c !== null && c.delivered === 'at-start' && c.text !== undefined ? c.text : null);
  if (taken.match !== 'shared') {
    const c = calls[0] ?? null;
    if (c === null) return { text: null, fields: { error: 'the record of the call is missing' }, delivered: 'nothing' };
    return {
      text: give(c),
      fields: {
        model: c.predicted,
        status: c.status,
        ...(c.rules !== undefined ? { rules: c.rules, sha256: c.sha256 } : {}),
        scope: c.scope ?? null,
        place: 'subagent',
      },
      delivered: c.delivered === 'already-delivered' ? 'already-delivered' : 'nothing',
    };
  }
  const texts = calls.map(give);
  const first = calls[0] ?? null;
  if (first !== null && calls.every((c) => c !== null && give(c) === give(first)) && texts[0] !== null)
    return {
      text: texts[0] ?? null,
      fields: { model: first.predicted, status: first.status, rules: first.rules, sha256: first.sha256, scope: first.scope ?? null, place: 'subagent' },
      delivered: 'nothing',
    };
  const models = new Set(calls.map((c) => c?.predicted ?? null));
  const model = models.size === 1 ? ([...models][0] ?? null) : null;
  if (model !== null && texts.every((t) => t !== null)) {
    const common = resolve(config, { model, scope: null, place: 'subagent' });
    if (common.status === 'matched')
      return { text: common.text, fields: { ...decisionFields(common), shared_rules: 'every-scope' }, delivered: 'nothing' };
  }
  const lost = texts.some((t) => t !== null);
  return { text: null, fields: { model, place: 'subagent', ...(lost ? { reason: 'calls-differ' } : {}) }, delivered: 'nothing' };
}

/**
 * The pool without the calls that can no longer start: those past the open window, and those made well
 * before the newest open call of their type. A shared group that loses a call this way is dropped with
 * the starts it counted, so a leftover count never settles a later call.
 */
function current(pool: Pool, now: number): Pool {
  const newest = new Map<string, number>();
  for (const c of pool.open) newest.set(c.type, Math.max(newest.get(c.type) ?? Number.NEGATIVE_INFINITY, Date.parse(c.at)));
  const live = (c: OpenCall): boolean => now - Date.parse(c.at) < OPEN_FOR_MS && (newest.get(c.type) ?? 0) - Date.parse(c.at) <= SIBLING_MS;
  const dropped = new Set(pool.open.filter((c) => !live(c)).map((c) => c.id));
  return settled({ open: pool.open.filter(live), groups: pool.groups.filter((g) => !g.calls.some((id) => dropped.has(id))) });
}

/** When a group counts as many started subagents as it has open calls, all of them have started. */
function settled(pool: Pool): Pool {
  let open = pool.open;
  const groups: SharedGroup[] = [];
  for (const g of pool.groups) {
    const members = g.calls.filter((id) => open.some((c) => c.id === id));
    if (g.started >= members.length) open = open.filter((c) => !members.includes(c.id));
    else if (g.started > 0) groups.push({ calls: members, started: g.started });
  }
  return { open, groups };
}

function without(pool: Pool, id: string): Pool {
  return settled({ open: pool.open.filter((c) => c.id !== id), groups: pool.groups });
}

/** The pool after a shared start among the given calls, counted in one group with any group it overlaps. */
function withShared(pool: Pool, calls: readonly string[]): Pool {
  const overlaps = (g: SharedGroup): boolean => g.calls.some((id) => calls.includes(id));
  const merged = pool.groups.filter(overlaps);
  const group: SharedGroup = {
    calls: [...new Set([...calls, ...merged.flatMap((g) => g.calls)])],
    started: merged.reduce((n, g) => n + g.started, 0) + 1,
  };
  return settled({ open: pool.open, groups: [...pool.groups.filter((g) => !overlaps(g)), group] });
}

export function agentResult(input: Record<string, unknown>, config: Config, ctx: SubagentContext): SubagentOutcome | null {
  const response = input.tool_response;
  const r = typeof response === 'object' && response !== null && !Array.isArray(response) ? (response as Record<string, unknown>) : {};
  const subagentId = str(r.agentId);
  const resolved = normalizeModel(str(r.resolvedModel)) || null;
  if (subagentId !== null && resolved !== null) {
    try {
      writeRecord(agentFile(ctx.state, subagentId), { model: resolved, at: ctx.now.toISOString() });
    } catch {
      // A call made inside that subagent then reads the subagent's transcript instead.
    }
  }

  const toolUseId = str(input.tool_use_id);
  const callFile = agentCallFile(ctx.state, toolUseId);
  const call = readAgentCall(callFile);
  // No prediction to check: noonsight did not see the call start, or delivery is off.
  if (call === null) return null;
  const startFile = agentStartFile(ctx.state, subagentId);
  const sessionId = str(input.session_id);
  // The result names the subagent the call started. A start not seen yet finds its call by it; a
  // shared start among this call's open calls now knows one more of them has started.
  let start: AgentStart | null = readAgentStart(startFile);
  let linked = false;
  if (toolUseId !== null && sessionId !== null && subagentId !== null && startFile !== null)
    ({ start, linked } = changePool(ctx.state, sessionId, (found) => {
      const pool = current(found, ctx.now.getTime());
      const seen = readAgentStart(startFile);
      if (!pool.open.some((c) => c.id === toolUseId)) return { pool: null, value: { start: seen, linked: false } };
      const groups =
        seen?.match === 'shared' ? pool.groups.map((g) => (g.calls.includes(toolUseId) ? { calls: g.calls, started: g.started - 1 } : g)) : pool.groups;
      if (seen === null) writeRecord(agentLinkFile(ctx.state, subagentId), { call: toolUseId, at: ctx.now.toISOString() });
      return { pool: without({ open: pool.open, groups }, toolUseId), value: { start: seen, linked: seen === null } };
    }));
  // Kept for a start not seen yet, which reads the rules from it and then removes it.
  if (!linked) removeRecord(callFile);

  const result = resolved === null ? 'unknown' : call.predicted === null ? 'unpredicted' : resolved === call.predicted ? 'match' : 'MISMATCH';
  const warn = result === 'MISMATCH' && config.subagents.onMismatch === 'warn';
  const usedModels = Array.isArray(r.modelsUsed) ? r.modelsUsed.filter((m): m is string => typeof m === 'string') : null;
  // What the subagent's start gave it, once seen; before, what its call hands over. A call neither
  // started nor still open, such as one past the open window, gave its subagent nothing.
  const delivered = start !== null ? (start.text !== null ? 'rules' : 'nothing') : !linked && call.delivered === 'at-start' ? 'nothing' : call.delivered;
  const got = delivered !== 'nothing' ? `the rules for ${call.predicted}` : 'no rules';
  return {
    record: {
      subagent_type: call.subagent_type,
      subagent_id: subagentId,
      predicted: call.predicted,
      model: resolved,
      ...(usedModels !== null ? { models_used: usedModels } : {}),
      result,
      delivered,
      ...(call.routing !== undefined ? { routing: call.routing } : {}),
      ...(call.routing_reason !== undefined ? { routing_reason: call.routing_reason } : {}),
      warned: warn,
    },
    messages: warn
      ? [
          `noonsight: subagent ${call.subagent_type}${subagentId !== null ? ` (${subagentId})` : ''} started on ${resolved}, ` +
            `not on ${call.predicted} as noonsight predicted, so it received ${got}.`,
        ]
      : [],
    specific: null,
  };
}

/**
 * The model of whoever makes the agent call.
 *
 * A call made inside a subagent carries that subagent's agent_id. Its model is the one noonsight
 * recorded from the result of the call that started it, which for a background subagent arrives at
 * once; for a subagent still running in the foreground, the model of its own transcript.
 *
 * A call made by the session: noonsight's record of the session, kept current by SessionStart and
 * PostModelSwitch; else the session's transcript; else the settings the session started with.
 */
function parentModel(input: Record<string, unknown>, ctx: SubagentContext): Parent {
  const sessionId = str(input.session_id);
  const transcript = str(input.transcript_path);
  const agentId = str(input.agent_id);
  if (agentId !== null) {
    const recorded = readAgentModel(agentFile(ctx.state, agentId));
    if (recorded !== null) return { model: recorded, source: 'agent-record' };
    const own = transcriptModel(subagentTranscript(transcript, sessionId, agentId), false);
    if (own !== null) return { model: own, source: 'agent-transcript' };
    return { model: null, source: null };
  }
  return sessionModel(input, ctx);
}

/**
 * The model of the session a hook input comes from: noonsight's record of the session, kept current
 * by SessionStart and PostModelSwitch; else the session's transcript; else the settings the session
 * started with.
 */
export function sessionModel(
  input: Record<string, unknown>,
  ctx: Pick<SubagentContext, 'env' | 'home' | 'state' | 'parentPid'>,
): { readonly model: string | null; readonly source: string | null } {
  const sessionId = str(input.session_id);
  const session = sessionId !== null ? readState(sessionFile(ctx.state, sessionId)) : null;
  if (session?.model) return { model: session.model, source: 'session-record' };
  const fromTranscript = transcriptModel(str(input.transcript_path), true);
  if (fromTranscript !== null) return { model: fromTranscript, source: 'session-transcript' };
  const launch = launchModel({ env: ctx.env, home: ctx.home, pid: ctx.parentPid, cwd: str(input.cwd) });
  if (launch.kind === 'found') return { model: launch.model, source: launch.source };
  return { model: null, source: null };
}

function undeclaredMessages(decision: Decision, prediction: Prediction, type: string, file: string): string[] {
  if (decision.status !== 'undeclared' || decision.warning === undefined) return [];
  if (decision.reason === 'no-entry')
    return [
      `noonsight: subagent ${type} will run on ${decision.model}, which is not declared in ${file}, so it gets no rules. ` +
        'Declare it under "models" (with "use": "none" if it needs no rules).',
    ];
  return [`noonsight: noonsight cannot tell which model subagent ${type} will run on (${prediction.why ?? 'no model is known'}), so it gets no rules.`];
}

export function decisionFields(d: Decision): Record<string, unknown> {
  return {
    model: d.model,
    status: d.status,
    ...('reason' in d ? { reason: d.reason } : {}),
    ...('key' in d ? { key: d.key } : {}),
    ...(d.status === 'matched' ? { rules: d.rules, sha256: d.sha256 } : {}),
    ...(d.status === 'matched' && d.triggered !== undefined ? { triggered_rules: d.triggered } : {}),
    scope: d.scope,
    ...(d.unknown_scope !== undefined ? { unknown_scope: d.unknown_scope } : {}),
    place: d.place,
  };
}

/** What the decision log records about where the scope and the place came from. */
export function choiceFields(scope: ScopeChoice, place?: PlaceChoice): Record<string, unknown> {
  return {
    scope_source: scope.source,
    ...(scope.matcher !== undefined ? { scope_matcher: scope.matcher } : {}),
    ...(place?.because !== undefined ? { unattended_env: place.because } : {}),
  };
}

/** A definition lookup that reads the definition directories once per name. */
function once(find: (name: string) => Definition | null): (name: string) => Definition | null {
  const seen = new Map<string, Definition | null>();
  return (name) => {
    if (!seen.has(name)) seen.set(name, find(name));
    return seen.get(name) ?? null;
  };
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}
