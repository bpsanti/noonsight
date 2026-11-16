// The Claude Code hook adapter for subagents: PreToolUse and PostToolUse on the agent tool.
//
//   PreToolUse   predicts the model the subagent will run on (predict.ts), resolves its rules for the
//                place "subagent", and returns the call with the rules added at the end of its task
//                text, with the permission decision the configuration asks for. A call it does not
//                change gets no decision. It records the prediction under the call's tool_use_id.
//   PostToolUse  compares the prediction with the model the subagent started on (resolvedModel in the
//                tool's response), logs match or MISMATCH, and warns on a mismatch. It records the
//                subagent's model under its agent id, for the calls that subagent makes in turn.
//
// Like the session hooks, neither ever blocks a call: an undeclared or unknown model only warns.

import { normalizeModel } from '../../core/normalize.js';
import { resolve } from '../../core/resolve.js';
import { taskScope } from '../../core/scope.js';
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
import { launchModel } from './launch.js';
import { defaultAccountDir } from './locations.js';
import { definitionFinder, predict, subagentTranscript, transcriptModel, type Prediction } from './predict.js';

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

const PERMISSION_REASON = 'sextant added the working rules for the subagent\'s model to the end of its task text';

export function agentCall(input: Record<string, unknown>, config: Config, ctx: SubagentContext): SubagentOutcome {
  const toolInput = input.tool_input;
  const callFile = agentCallFile(ctx.state, str(input.tool_use_id));
  if (typeof toolInput !== 'object' || toolInput === null || Array.isArray(toolInput))
    return { record: { status: 'error', error: 'the call has no tool_input', delivered: 'nothing', warned: false }, messages: [], specific: null };
  const ti = toolInput as Record<string, unknown>;
  const subagentType = str(ti.subagent_type) ?? 'general-purpose';
  const requested = str(ti.model);
  const base = { subagent_type: subagentType, requested_model: requested };

  if (config.subagents.delivery === 'off') return { record: { ...base, delivered: 'off', warned: false }, messages: [], specific: null };

  const parent = parentModel(input, ctx);
  const projectDir = ctx.env.CLAUDE_PROJECT_DIR || str(input.cwd);
  const prediction = predict({
    subagentType,
    requested,
    parent: parent.model,
    env: ctx.env,
    findDefinition: definitionFinder({ projectDir, configDir: defaultAccountDir(ctx.env, ctx.home) }),
  });
  const prompt = typeof ti.prompt === 'string' ? ti.prompt : null;
  // The subagent's own task decides its scope; the session's scope does not carry over.
  const scope = taskScope(config, { description: str(ti.description), prompt });
  const decision = resolve(config, { model: prediction.model, scope, place: 'subagent' });

  let delivered: AgentCall['delivered'] = 'nothing';
  let specific: Record<string, unknown> | null = null;
  if (decision.status === 'matched' && prompt !== null) {
    if (prompt.includes(decision.text)) delivered = 'already-delivered';
    else {
      delivered = 'rules';
      const permission = config.subagents.permission;
      specific = {
        hookEventName: 'PreToolUse',
        ...(permission !== 'passthrough' ? { permissionDecision: permission, permissionDecisionReason: PERMISSION_REASON } : {}),
        updatedInput: { ...ti, prompt: `${prompt}\n\n${decision.text}` },
      };
    }
  }

  const messages = undeclaredMessages(decision, prediction, subagentType, ctx.file);
  const call: AgentCall = {
    session_id: str(input.session_id),
    subagent_type: subagentType,
    predicted: decision.model,
    status: decision.status,
    sha256: decision.status === 'matched' ? decision.sha256 : null,
    delivered,
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
      model_source: prediction.source,
      ...(prediction.value !== undefined ? { model_value: prediction.value } : {}),
      ...(prediction.definition !== undefined ? { definition: prediction.definition } : {}),
      ...(prediction.why !== undefined ? { unresolved_why: prediction.why } : {}),
      ...(prompt === null && decision.status === 'matched' ? { error: 'the call has no prompt' } : {}),
      delivered,
      ...(delivered === 'rules' ? { permission: config.subagents.permission } : {}),
      warned: messages.length > 0,
    },
    messages,
    specific,
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
    place: d.place,
  };
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}
