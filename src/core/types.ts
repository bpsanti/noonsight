// Data the core works on. The core never reads files, the network, the clock or any state:
// the configuration loader builds these values, and the core only computes over them.

/** Where the delivered text will be read. */
export const PLACES = ['session', 'unattended', 'subagent'] as const;
export type Place = (typeof PLACES)[number];

/** Scope marker for a rule that applies to every task scope. */
export const ANY_SCOPE = '*';

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
  readonly text: string;
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

export interface Config {
  /** Exact model keys, each a full normalized identifier such as claude-fable-5-2. */
  readonly exact: ReadonlyMap<string, ModelEntry>;
  /** Wildcard keys, sorted by precedence (most literal first, then by key). */
  readonly wildcards: readonly WildcardKey[];
  readonly onUndeclared: 'warn' | 'ignore';
  /** Every declared scope name: the preset's and the user's. */
  readonly scopes: ReadonlySet<string>;
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
