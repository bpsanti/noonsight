// The Claude Code hook adapter for subagents: PreToolUse and PostToolUse on the agent tool.
//
//   PreToolUse   predicts the model the subagent will run on (predict.ts), resolves its rules for the
//                place "subagent", and returns the call with the rules added at the end of its task
//                text, with the permission decision the configuration asks for. A call it does not
//                change gets no decision. It records the prediction under the call's tool_use_id.
//                With classifier.mode on, a task its matchers did not place may wait for the
//                classifier (classifier.ts), up to classifier.timeout_ms.
//   PostToolUse  compares the prediction with the model the subagent started on (resolvedModel in the
//                tool's response), logs match or MISMATCH, and warns on a mismatch. It records the
//                subagent's model under its agent id, for the calls that subagent makes in turn.
//
// Like the session hooks, neither ever blocks a call: an undeclared or unknown model only warns.

import { normalizeModel } from '../../core/normalize.js';
import { resolve, scopeChangesRules } from '../../core/resolve.js';
import { route, routeReadsScope, routingGate } from '../../core/route.js';
import { taskScope, taskText, type PlaceChoice, type ScopeChoice } from '../../core/scope.js';
import type { Config, Decision } from '../../core/types.js';
import {
  agentCallFile,
  agentFile,
  readAgentCall,
  readAgentModel,
  removeRecord,
  writeRecord,
  type AgentCall,
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
      ? [`sextant: the classifier could not place the task of subagent ${subagentType} (${classified.failure}), so it has no scope.`]
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
    const specific = Object.keys(changes).length > 0 ? changed(config, { ...ti, ...changes }, changes, false) : null;
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

  let delivered: AgentCall['delivered'] = 'nothing';
  let newPrompt = prompt;
  if (decision.status === 'matched' && prompt !== null) {
    if (prompt.includes(decision.text)) delivered = 'already-delivered';
    else {
      delivered = 'rules';
      newPrompt = `${prompt}\n\n${decision.text}`;
    }
  }
  const rewritten = delivered === 'rules' || Object.keys(changes).length > 0;
  const specific = rewritten ? changed(config, { ...ti, ...changes, ...(newPrompt !== null ? { prompt: newPrompt } : {}) }, changes, delivered === 'rules') : null;

  const messages = [...unplaced, ...undeclaredMessages(decision, prediction, subagentType, ctx.file)];
  const call: AgentCall = {
    session_id: str(input.session_id),
    subagent_type: subagentType,
    predicted: decision.model,
    status: decision.status,
    sha256: decision.status === 'matched' ? decision.sha256 : null,
    delivered,
    routing: routed.routing,
    routing_reason: routed.reason,
    at: ctx.now.toISOString(),
  };
  try {
    writeRecord(callFile, call);
  } catch {
    // Without the record, the result of this call is not checked; the rules were still delivered.
  }
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
      ...(prompt === null && decision.status === 'matched' ? { error: 'the call has no prompt' } : {}),
      delivered,
      ...(rewritten ? { permission: config.subagents.permission } : {}),
      warned: messages.length > 0,
    },
    messages,
    specific,
  };
}

/** The hookSpecificOutput for a call sextant changed, with the permission decision the configuration asks for. */
function changed(config: Config, updatedInput: Record<string, unknown>, routed: Record<string, unknown>, rules: boolean): Record<string, unknown> {
  const permission = config.subagents.permission;
  const set = Object.entries(routed).map(([k, v]) => `${k} ${String(v)}`);
  const what = [
    ...(set.length > 0 ? [`set the subagent's ${set.join(' and ')} from its task scope`] : []),
    ...(rules ? ["added the working rules for the subagent's model to the end of its task text"] : []),
  ];
  return {
    hookEventName: 'PreToolUse',
    ...(permission !== 'passthrough' ? { permissionDecision: permission, permissionDecisionReason: `sextant ${what.join(', and ')}` } : {}),
    updatedInput,
  };
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

  const callFile = agentCallFile(ctx.state, str(input.tool_use_id));
  const call = readAgentCall(callFile);
  // No prediction to check: sextant did not see the call start, or delivery is off.
  if (call === null) return null;
  removeRecord(callFile);

  const result = resolved === null ? 'unknown' : call.predicted === null ? 'unpredicted' : resolved === call.predicted ? 'match' : 'MISMATCH';
  const warn = result === 'MISMATCH' && config.subagents.onMismatch === 'warn';
  const usedModels = Array.isArray(r.modelsUsed) ? r.modelsUsed.filter((m): m is string => typeof m === 'string') : null;
  const got = call.delivered === 'nothing' ? 'no rules' : `the rules for ${call.predicted}`;
  return {
    record: {
      subagent_type: call.subagent_type,
      subagent_id: subagentId,
      predicted: call.predicted,
      model: resolved,
      ...(usedModels !== null ? { models_used: usedModels } : {}),
      result,
      delivered: call.delivered,
      ...(call.routing !== undefined ? { routing: call.routing } : {}),
      ...(call.routing_reason !== undefined ? { routing_reason: call.routing_reason } : {}),
      warned: warn,
    },
    messages: warn
      ? [
          `sextant: subagent ${call.subagent_type}${subagentId !== null ? ` (${subagentId})` : ''} started on ${resolved}, ` +
            `not on ${call.predicted} as sextant predicted, so it received ${got}.`,
        ]
      : [],
    specific: null,
  };
}

/**
 * The model of whoever makes the agent call.
 *
 * A call made inside a subagent carries that subagent's agent_id. Its model is the one sextant
 * recorded from the result of the call that started it, which for a background subagent arrives at
 * once; for a subagent still running in the foreground, the model of its own transcript.
 *
 * A call made by the session: sextant's record of the session, kept current by SessionStart and
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
  const session = sessionId !== null ? readState(sessionFile(ctx.state, sessionId)) : null;
  if (session?.model) return { model: session.model, source: 'session-record' };
  const fromTranscript = transcriptModel(transcript, true);
  if (fromTranscript !== null) return { model: fromTranscript, source: 'session-transcript' };
  const launch = launchModel({ env: ctx.env, home: ctx.home, pid: ctx.parentPid, cwd: str(input.cwd) });
  if (launch.kind === 'found') return { model: launch.model, source: launch.source };
  return { model: null, source: null };
}

function undeclaredMessages(decision: Decision, prediction: Prediction, type: string, file: string): string[] {
  if (decision.status !== 'undeclared' || decision.warning === undefined) return [];
  if (decision.reason === 'no-entry')
    return [
      `sextant: subagent ${type} will run on ${decision.model}, which is not declared in ${file}, so it gets no rules. ` +
        'Declare it under "models" (with "use": "none" if it needs no rules).',
    ];
  return [`sextant: sextant cannot tell which model subagent ${type} will run on (${prediction.why ?? 'no model is known'}), so it gets no rules.`];
}

export function decisionFields(d: Decision): Record<string, unknown> {
  return {
    model: d.model,
    status: d.status,
    ...('reason' in d ? { reason: d.reason } : {}),
    ...('key' in d ? { key: d.key } : {}),
    ...(d.status === 'matched' ? { rules: d.rules, sha256: d.sha256 } : {}),
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
