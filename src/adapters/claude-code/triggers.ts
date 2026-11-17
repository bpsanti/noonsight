// The Claude Code hook adapter for triggers: PostToolUse on Edit and Write.
//
// A session whose scope nobody named still shows what kind of task it is on by what it does. When the
// session first edits a code file the project's git already tracks (code-edit.ts), it is building, so
// the rules that list the code-edit trigger are delivered with that edit, as additionalContext, which
// Claude Code adds to the conversation right after the tool's result.
//
//   - Only the session's own edits count. An edit inside a subagent carries the subagent's agent_id and
//     is left alone: a subagent's scope comes from its own task, and its rules from its start.
//   - A session reveals each trigger once. The trigger's record is created once, so of several edits
//     running their hooks at once exactly one delivers, and every later edit costs one file lookup.
//   - Only the rules the trigger adds are delivered: the session's conversation already holds the rest.
//   - The session's record is updated with the rules it now holds, so a resume does not deliver them
//     again, and SessionStart after compaction and PostModelSwitch resolve with the triggers revealed.

import { resolve, resolveAdded } from '../../core/resolve.js';
import { sessionPlace, sessionScope } from '../../core/scope.js';
import { hasCodeExtension } from '../../core/triggers.js';
import { TRIGGERS, type Config, type Trigger } from '../../core/types.js';
import type { Env } from '../../config/paths.js';
import type { DeliveryState } from '../../state/sessions.js';
import { claimTrigger, sessionTriggers } from '../../state/triggers.js';
import { codeEdit, namedFile } from './code-edit.js';
import { choiceFields, decisionFields, sessionModel } from './subagents.js';

export interface TriggerContext {
  readonly env: Env;
  readonly home: string;
  readonly now: Date;
  readonly state: string;
  readonly parentPid: number;
}

export interface TriggerOutcome {
  readonly record: Record<string, unknown>;
  /** The rules the trigger added, or null when it added none. */
  readonly context: string | null;
  /** What the session holds after this decision, or null to leave its record as it was. */
  readonly state: Omit<DeliveryState, 'at'> | null;
}

/**
 * Whether an edit could reveal a trigger, from what costs no configuration and no process: an edit of
 * the session itself, of a code file that is there, in a session that has not revealed every trigger.
 * Every edit runs the hook, so the hook reads the configuration only past this check.
 */
export function mayReveal(input: Record<string, unknown>, state: string): boolean {
  if (str(input.agent_id) !== null) return false;
  if (sessionTriggers(state, str(input.session_id)).length === TRIGGERS.length) return false;
  const file = namedFile(input);
  return file !== null && hasCodeExtension(file);
}

/**
 * PostToolUse on Edit and Write. Returns null, with nothing to log, for an edit that reveals no new
 * trigger: one inside a subagent, a trigger no rule lists, a
 * trigger the session already revealed, or an edit that is not a code edit.
 */
export function fileEdit(input: Record<string, unknown>, config: Config, ctx: TriggerContext): TriggerOutcome | null {
  const trigger: Trigger = 'code-edit';
  if (str(input.agent_id) !== null) return null;
  const sessionId = str(input.session_id);
  if (sessionId === null || !listsTrigger(config, trigger)) return null;
  const held = sessionTriggers(ctx.state, sessionId);
  if (held.includes(trigger)) return null;

  const edit = codeEdit(input, ctx.env);
  if (edit.kind !== 'code') return null;
  if (!claimTrigger(ctx.state, sessionId, { trigger, tool: edit.tool, file: edit.file, at: ctx.now.toISOString() })) return null;

  const model = sessionModel(input, ctx);
  const scope = sessionScope(ctx.env);
  const place = sessionPlace(config, ctx.env);
  const triggers = TRIGGERS.filter((t) => t === trigger || held.includes(t));
  const request = { model: model.model, scope: scope.scope, place: place.place, triggers };
  const added = resolveAdded(config, request, held);
  const whole = resolve(config, request);
  return {
    record: {
      trigger,
      file: edit.file,
      ...decisionFields(added),
      ...choiceFields(scope, place),
      model_source: model.source,
      triggers,
      delivered: added.status === 'matched' ? 'rules' : 'nothing',
      // The session's start already warned about an undeclared or unknown model.
      warned: false,
    },
    context: added.status === 'matched' ? added.text : null,
    state: whole.model === null ? null : { model: whole.model, status: whole.status, sha256: whole.status === 'matched' ? whole.sha256 : null },
  };
}

/** Whether any rule of any declared model lists the trigger. */
function listsTrigger(config: Config, trigger: Trigger): boolean {
  for (const entry of config.exact.values()) if (entry.use === 'rules' && entry.rules.some((r) => r.triggers.includes(trigger))) return true;
  return false;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}
