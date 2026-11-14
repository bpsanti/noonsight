import { createHash } from 'node:crypto';
import { normalizeModel } from './normalize.js';
import { ANY_SCOPE } from './types.js';
import type { Config, Decision, ModelEntry, Place, Rule } from './types.js';

export interface ResolveRequest {
  /** The model as the tool reported it; it is normalized first. */
  readonly model: string | null | undefined;
  /** The task scope, or null when no scope is known. */
  readonly scope?: string | null;
  readonly place: Place;
}

/**
 * Decide which rules a model receives for a scope and a place.
 * Pure: the same configuration and request always give the same decision, text and hash.
 *
 * 1. The model picks the entry: an exact key wins over any wildcard; among wildcards, more
 *    literal text wins. No entry means "undeclared".
 * 2. The scope narrows the rules: rules for every scope, plus rules for the current scope.
 *    An unknown scope only means "general rules"; it never blocks and never warns.
 * 3. The place narrows them again.
 */
export function resolve(config: Config, request: ResolveRequest): Decision {
  const model = normalizeModel(request.model);
  const askedScope = request.scope ?? null;
  const scope = askedScope !== null && config.scopes.has(askedScope) ? askedScope : null;
  const base = {
    scope,
    ...(askedScope !== null && scope === null ? { unknown_scope: askedScope } : {}),
    place: request.place,
  };

  if (!model) return undeclared(config, { ...base, model: null, reason: 'model-not-reported' });

  const match = matchModel(config, model);
  if (!match) return undeclared(config, { ...base, model, reason: 'no-entry' });

  const { key, entry } = match;
  if (entry.use === 'none') return { status: 'none', reason: 'declared-none', model, key, ...base };

  const picked = selectRules(entry.rules, scope, request.place);
  if (picked.length === 0) return { status: 'none', reason: 'no-rule-applies', model, key, ...base };

  const joined = joinRules(picked);
  const ids = picked.map((r) => r.id);
  return {
    status: 'matched',
    model,
    key,
    ...base,
    rules: ids,
    sha256: shortHash(joined),
    text: envelope(model, scope, ids, joined),
  };
}

/** The rules of a rule list that apply to a scope and a place, in declaration order. */
export function selectRules(rules: readonly Rule[], scope: string | null, place: Place): Rule[] {
  return rules.filter(
    (r) => (r.scopes.includes(ANY_SCOPE) || (scope !== null && r.scopes.includes(scope))) && r.where.includes(place),
  );
}

export function joinRules(rules: readonly Rule[]): string {
  return rules.map((r) => r.text).join('\n\n');
}

/**
 * The delivered text. It says where the text came from, written as facts, because Claude Code
 * documents that hook context which reads like a system command can trip prompt-injection defenses.
 */
export function envelope(model: string, scope: string | null, ruleIds: readonly string[], joined: string): string {
  const scopeAttr = scope !== null ? ` scope="${scope}"` : '';
  const scopeText = scope !== null ? `, task scope "${scope}"` : '';
  return (
    `<sextant-rules model="${model}"${scopeAttr}>\n` +
    `Working rules the user declared for ${model}${scopeText} (delivered by sextant, rules ${ruleIds.join(', ')}):\n` +
    `${joined}\n` +
    `</sextant-rules>`
  );
}

function matchModel(config: Config, model: string): { key: string; entry: ModelEntry } | null {
  const exact = config.exact.get(model);
  if (exact) return { key: model, entry: exact };
  // Wildcards are pre-sorted by precedence, and they all mean "no rules", so the first hit decides.
  const hit = config.wildcards.find((w) => w.pattern.test(model));
  return hit ? { key: hit.key, entry: { use: 'none' } } : null;
}

function undeclared(
  config: Config,
  d: { model: string | null; reason: 'model-not-reported' | 'no-entry'; scope: string | null; unknown_scope?: string; place: Place },
): Decision {
  const warning =
    config.onUndeclared === 'warn'
      ? `sextant: model ${d.model ?? '(not reported)'} has no declared rules (${d.reason}, ${d.place})`
      : undefined;
  return { status: 'undeclared', ...d, ...(warning !== undefined ? { warning } : {}) };
}

function shortHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}
