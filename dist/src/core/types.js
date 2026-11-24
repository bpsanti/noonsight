// Data the core works on. The core never reads files, the network, the clock or any state:
// the configuration loader builds these values, and the core only computes over them.
/**
 * Where the delivered text will be read.
 *   attended    a session someone is watching.
 *   unattended  a session nobody is watching.
 *   subagent    a subagent's task.
 */
export const PLACES = ['attended', 'unattended', 'subagent'];
/** The word a rule's "where" may give alone for every place. */
export const ALL_PLACES = 'all';
/**
 * Earlier names of places, still read where a place is written: in "where", on the command line, and
 * in the decision log. "session" is the earlier name of "attended": configurations and logs written
 * with it keep their meaning.
 */
export const PLACE_ALIASES = { session: 'attended' };
/** A place written by its name or an earlier one, as its current name; null when it names no place. */
export function placeName(value) {
    return PLACES.includes(value) ? value : (PLACE_ALIASES[value] ?? null);
}
/** Scope marker for a rule that applies to every task scope. */
export const ANY_SCOPE = '*';
/**
 * What a session can do that shows what kind of task it is on, without anyone naming a scope.
 *   code-edit  the session edited a code file the project's git already tracks.
 * A rule that lists a trigger is also delivered to a session once the session has done it, whatever
 * the session's scope. Only a session reveals a trigger; a subagent's scope comes from its task.
 */
export const TRIGGERS = ['code-edit'];
/**
 * Claude Code replaces hook context longer than this with a file path and a short preview,
 * so every text the core can produce must fit.
 */
export const DELIVERY_TEXT_LIMIT = 10000;
/** Room kept for the note that says the session's model changed (see switchNote). */
export const SWITCH_NOTE_RESERVE = 500;
/**
 * Stands for every model in the models a conversation may hold rules of, when which ones cannot be
 * told: a model-change note then retires the rules of every model but the session's own.
 */
export const ANY_MODEL = '*';
/** The longest rule text, envelope included, a configuration may produce: the note must still fit. */
export const RULES_TEXT_LIMIT = DELIVERY_TEXT_LIMIT - SWITCH_NOTE_RESERVE;
export const DEFAULT_SUBAGENT_SETTINGS = { delivery: 'prompt', permission: 'allow', onMismatch: 'warn' };
/** Flags every scope matcher is compiled with: case-insensitive, Unicode-aware. */
export const MATCHER_FLAGS = 'iu';
export const DEFAULT_SESSION_SETTINGS = { unattendedWhenEnv: [], headlessIsUnattended: true };
/** Where routing can act: the session `noonsight run` starts, and the subagents a session starts. */
export const ROUTE_TARGETS = ['launcher', 'subagents'];
/** The effort levels Claude Code accepts, for --effort and for an agent call's effort parameter. */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
/**
 * The model aliases a routing table may name. Each selects the latest model of its family, and both
 * the claude --model option and the agent tool's model parameter accept them.
 */
export const ROUTE_ALIASES = ['fable', 'opus', 'sonnet', 'haiku'];
export const DEFAULT_ROUTING_SETTINGS = {
    enabled: false,
    targets: ROUTE_TARGETS,
    respectExplicit: true,
    yieldWhenEnv: [],
    table: new Map(),
    default: null,
};
/**
 * When the classifier, a small model asked through `claude -p`, picks a task's scope.
 *   off       never: a scope comes only from NOONSIGHT_SCOPE, --scope or the matchers.
 *   fallback  only for a task no explicit scope and no matcher placed.
 *   always    for every task without an explicit scope, over the matchers.
 */
export const CLASSIFIER_MODES = ['off', 'fallback', 'always'];
export const DEFAULT_CLASSIFIER_SETTINGS = { mode: 'off', model: 'haiku', effort: 'low', timeoutMs: 8000 };
//# sourceMappingURL=types.js.map