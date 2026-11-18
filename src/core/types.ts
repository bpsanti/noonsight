// Data the core works on. The core never reads files, the network, the clock or any state:
// the configuration loader builds these values, and the core only computes over them.

/** Where the delivered text will be read. */
export const PLACES = ['session', 'unattended', 'subagent'] as const;
export type Place = (typeof PLACES)[number];

/** Scope marker for a rule that applies to every task scope. */
export const ANY_SCOPE = '*';

/**
 * What a session can do that shows what kind of task it is on, without anyone naming a scope.
 *   code-edit  the session edited a code file the project's git already tracks.
 * A rule that lists a trigger is also delivered to a session once the session has done it, whatever
 * the session's scope. Only a session reveals a trigger; a subagent's scope comes from its task.
 */
export const TRIGGERS = ['code-edit'] as const;
export type Trigger = (typeof TRIGGERS)[number];

/**
 * Claude Code replaces hook context longer than this with a file path and a short preview,
 * so every text the core can produce must fit.
 */
export const DELIVERY_TEXT_LIMIT = 10000;

/** Room kept for the note that says the session's model changed (see switchNote). */
export const SWITCH_NOTE_RESERVE = 500;

/** The longest rule text, envelope included, a configuration may produce: the note must still fit. */
export const RULES_TEXT_LIMIT = DELIVERY_TEXT_LIMIT - SWITCH_NOTE_RESERVE;

/** One rule, with its text already read and normalized. */
export interface Rule {
  readonly id: string;
  readonly origin: 'preset' | 'user';
  /** Either exactly [ANY_SCOPE] or a list of declared scope names. */
  readonly scopes: readonly string[];
  readonly where: readonly Place[];
  /** The triggers that also deliver the rule to a session whose scope is not one of its scopes. */
  readonly triggers: readonly Trigger[];
  readonly text: string;
  /** Set on a user rule that came from the configuration's top-level "all_models" block, not from a model's own "add". */
  readonly allModels?: true;
  /** Set on a user rule delivered in place of a preset rule: that rule's id, as the preset it is delivered from names it. */
  readonly replaces?: string;
  /** Set on a user rule that came from the project's configuration, laid over the machine's. */
  readonly project?: true;
}

/** What a declared model resolves to, after preset rules, enable, disable and add are applied. */
export type ModelEntry =
  | { readonly use: 'none' }
  | { readonly use: 'rules'; readonly rules: readonly Rule[] };

/** A wildcard model key. Wildcards only ever declare "no rules". */
export interface WildcardKey {
  readonly key: string;
  readonly pattern: RegExp;
  /** Number of literal (non-wildcard) characters; more literal text wins. */
  readonly literal: number;
}

/** How subagents get their rules; the keys under "subagents" in the configuration. */
export interface SubagentSettings {
  /** prompt: each subagent gets the rules for its model when it starts. off: subagents are left alone. */
  readonly delivery: 'prompt' | 'off';
  /** The permission decision returned with a call routing changed; passthrough returns none. */
  readonly permission: 'allow' | 'ask' | 'passthrough';
  /** What to do when a subagent starts on another model than the one its rules were chosen for. */
  readonly onMismatch: 'warn' | 'ignore';
}

export const DEFAULT_SUBAGENT_SETTINGS: SubagentSettings = { delivery: 'prompt', permission: 'allow', onMismatch: 'warn' };

/** One way a task names its scope: a case-insensitive regular expression run over the task text. */
export interface ScopeMatcher {
  /** The expression as the configuration writes it. */
  readonly source: string;
  /** Compiled with the flags in MATCHER_FLAGS. */
  readonly regex: RegExp;
}

/** Flags every scope matcher is compiled with: case-insensitive, Unicode-aware. */
export const MATCHER_FLAGS = 'iu';

/** A declared task scope, with the preset's keys and the user's merged. */
export interface Scope {
  readonly name: string;
  readonly description?: string;
  /** Matched against a subagent's task text. */
  readonly match: readonly ScopeMatcher[];
}

/** How a session's place is told; the keys under "session" in the configuration. */
export interface SessionSettings {
  /** Environment variables that, when any is set and not empty, mark a session as unattended. */
  readonly unattendedWhenEnv: readonly string[];
}

export const DEFAULT_SESSION_SETTINGS: SessionSettings = { unattendedWhenEnv: [] };

/** Where routing can act: the session `noonsight run` starts, and the subagents a session starts. */
export const ROUTE_TARGETS = ['launcher', 'subagents'] as const;
export type RouteTarget = (typeof ROUTE_TARGETS)[number];

/** The effort levels Claude Code accepts, for --effort and for an agent call's effort parameter. */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];

/**
 * The model aliases a routing table may name. Each selects the latest model of its family, and both
 * the claude --model option and the agent tool's model parameter accept them.
 */
export const ROUTE_ALIASES = ['fable', 'opus', 'sonnet', 'haiku'] as const;

/** One choice in a routing table row: a model alias or a declared model identifier, and an optional effort. */
export interface RouteOption {
  readonly model: string;
  readonly effort?: Effort;
}

/**
 * A routing table row: the options for each target, in order of preference. A target the row does not
 * list falls to routing.default; an empty list means "do not route".
 */
export type RouteRow = Partial<Readonly<Record<RouteTarget, readonly RouteOption[]>>>;

/** The keys under "routing" in the configuration, with the preset's table merged in. */
export interface RoutingSettings {
  readonly enabled: boolean;
  readonly targets: readonly RouteTarget[];
  /** A model the caller already chose (claude --model, an agent call's model) wins over the table. */
  readonly respectExplicit: boolean;
  /** Environment variables that, when any is set and not empty, make routing yield. */
  readonly yieldWhenEnv: readonly string[];
  /** Scope name to row: the preset's rows, each replaced by the user's row of the same scope. */
  readonly table: ReadonlyMap<string, RouteRow>;
  /** The row for a task with no scope, or whose scope has no row for the target; null means inherit. */
  readonly default: RouteRow | null;
}

export const DEFAULT_ROUTING_SETTINGS: RoutingSettings = {
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
export const CLASSIFIER_MODES = ['off', 'fallback', 'always'] as const;
export type ClassifierMode = (typeof CLASSIFIER_MODES)[number];

/** The keys under "classifier" in the configuration. */
export interface ClassifierSettings {
  readonly mode: ClassifierMode;
  /** The model the classifier runs on, as claude --model takes it: an alias or an identifier. */
  readonly model: string;
  readonly effort: Effort;
  /** How long a classification may take before the task gets no scope. */
  readonly timeoutMs: number;
}

export const DEFAULT_CLASSIFIER_SETTINGS: ClassifierSettings = { mode: 'off', model: 'haiku', effort: 'low', timeoutMs: 8000 };

export interface Config {
  /** Exact model keys, each a full normalized identifier such as claude-fable-5-2. */
  readonly exact: ReadonlyMap<string, ModelEntry>;
  /** Wildcard keys, sorted by precedence (most literal first, then by key). */
  readonly wildcards: readonly WildcardKey[];
  readonly onUndeclared: 'warn' | 'ignore';
  /**
   * The rules of the "all_models" block, in declaration order. Each is already part of the rules of
   * every exact model declared with "use": "preset" or "use": "custom"; they are kept here only so a
   * command can describe the block.
   */
  readonly allModels: readonly Rule[];
  /**
   * Every declared scope, the preset's and the user's, in declaration order: the preset's first,
   * then the user's new ones. The order breaks ties when a task matches more than one scope.
   */
  readonly scopes: ReadonlyMap<string, Scope>;
  readonly session: SessionSettings;
  readonly subagents: SubagentSettings;
  readonly routing: RoutingSettings;
  readonly classifier: ClassifierSettings;
}

interface DecisionBase {
  /** The normalized model identifier, or null when the tool reported no model. */
  readonly model: string | null;
  /** The declared scope the decision used, or null for "general rules only". */
  readonly scope: string | null;
  /** Present when the caller asked for a scope that is not declared; general rules apply. */
  readonly unknown_scope?: string;
  readonly place: Place;
}

export interface MatchedDecision extends DecisionBase {
  readonly status: 'matched';
  readonly model: string;
  readonly key: string;
  readonly rules: readonly string[];
  /** The rules among `rules` that only a trigger the session revealed brought; absent when there are none. */
  readonly triggered?: readonly string[];
  /** First 16 hex characters of the SHA-256 of the joined rule text. */
  readonly sha256: string;
  /** The exact text that would be delivered, envelope included. */
  readonly text: string;
}

export interface NoneDecision extends DecisionBase {
  readonly status: 'none';
  readonly model: string;
  readonly key: string;
  /** declared-none: the user decided this model needs no rules. no-rule-applies: no rule fits this scope and place. */
  readonly reason: 'declared-none' | 'no-rule-applies';
}

export interface UndeclaredDecision extends DecisionBase {
  readonly status: 'undeclared';
  readonly reason: 'model-not-reported' | 'no-entry';
  /** Present when the configuration asks to warn about undeclared models. */
  readonly warning?: string;
}

export type Decision = MatchedDecision | NoneDecision | UndeclaredDecision;
