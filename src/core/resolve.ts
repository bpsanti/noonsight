import { createHash } from 'node:crypto';
import { normalizeModel } from './normalize.js';
import { ANY_SCOPE, SWITCH_NOTE_RESERVE } from './types.js';
import type { Config, Decision, ModelEntry, Place, Rule, Trigger } from './types.js';

export interface ResolveRequest {
  /** The model as the tool reported it; it is normalized first. */
  readonly model: string | null | undefined;
  /** The task scope, or null when no scope is known. */
  readonly scope?: string | null;
  readonly place: Place;
  /** The triggers the session has revealed; none when left out. */
  readonly triggers?: readonly Trigger[];
}

/**
 * Decide which rules a model receives for a scope and a place.
 * Pure: the same configuration and request always give the same decision, text and hash.
 *
 * 1. The model picks the entry: an exact key wins over any wildcard; among wildcards, more
 *    literal text wins. No entry means "undeclared".
 * 2. The scope narrows the rules: rules for every scope, plus rules for the current scope, plus
 *    rules that list a trigger the session revealed.
 *    An unknown scope only means "general rules"; it never blocks and never warns.
 * 3. The place narrows them again.
 */
export function resolve(config: Config, request: ResolveRequest): Decision {
  return decide(config, request, null);
}

/**
 * The rules a session receives when it reveals more triggers: the decision for the request's
 * triggers, less every rule the session already received with only the triggers in `held`. A session's
 * scope only grows, and the rules it received stay in its conversation, so only the new ones are sent.
 * No new rule gives the status "none" with the reason "no-rule-applies".
 */
export function resolveAdded(config: Config, request: ResolveRequest, held: readonly Trigger[]): Decision {
  return decide(config, request, held);
}

function decide(config: Config, request: ResolveRequest, held: readonly Trigger[] | null): Decision {
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

  const triggers = request.triggers ?? [];
  let picked = selectRules(entry.rules, scope, request.place, triggers);
  if (held !== null) {
    const before = new Set(selectRules(entry.rules, scope, request.place, held).map((r) => r.id));
    picked = picked.filter((r) => !before.has(r.id));
  }
  if (picked.length === 0) return { status: 'none', reason: 'no-rule-applies', model, key, ...base };

  const delivery = deliveryText(model, picked, scope, triggers);
  return {
    status: 'matched',
    model,
    key,
    ...base,
    rules: delivery.ids,
    ...(delivery.triggered.length ? { triggered: delivery.triggered } : {}),
    sha256: shortHash(joinRules(picked)),
    text: delivery.text,
  };
}

/**
 * Whether the scope of a task can change the rules a model receives in a place: some rule the model
 * receives there is for a list of scopes rather than every scope. Without one, every scope gives the
 * same rules.
 */
export function scopeChangesRules(config: Config, model: string | null, place: Place): boolean {
  const normalized = normalizeModel(model);
  const entry = normalized ? matchModel(config, normalized)?.entry : undefined;
  return entry?.use === 'rules' && entry.rules.some((r) => !r.scopes.includes(ANY_SCOPE) && r.where.includes(place));
}

/** Whether a rule applies to a scope by its scopes alone. */
function inScope(rule: Rule, scope: string | null): boolean {
  return rule.scopes.includes(ANY_SCOPE) || (scope !== null && rule.scopes.includes(scope));
}

/**
 * The rules of a rule list that apply to a scope and a place, in declaration order: those for the
 * scope, and those that list one of the triggers.
 */
export function selectRules(rules: readonly Rule[], scope: string | null, place: Place, triggers: readonly Trigger[] = []): Rule[] {
  return rules.filter((r) => (inScope(r, scope) || r.triggers.some((t) => triggers.includes(t))) && r.where.includes(place));
}

/** The text delivered for these rules, with their ids, and those of them only a trigger brought. */
export function deliveryText(
  model: string,
  rules: readonly Rule[],
  scope: string | null,
  triggers: readonly Trigger[],
): { readonly text: string; readonly ids: readonly string[]; readonly triggered: readonly string[] } {
  const ids = rules.map((r) => r.id);
  const triggeredRules = rules.filter((r) => !inScope(r, scope));
  const shown = triggers.filter((t) => triggeredRules.some((r) => r.triggers.includes(t)));
  return { text: envelope(model, scope, ids, joinRules(rules), shown), ids, triggered: triggeredRules.map((r) => r.id) };
}

export function joinRules(rules: readonly Rule[]): string {
  return rules.map((r) => r.text).join('\n\n');
}

/** How the envelope describes a session that revealed a trigger. */
const TRIGGER_TEXT: Readonly<Record<Trigger, string>> = {
  'code-edit': "a session that has edited the project's code",
};

/**
 * The delivered text. It says where the text came from, written as facts, because Claude Code
 * documents that hook context which reads like a system command can trip prompt-injection defenses.
 * `triggers` are the triggers that brought some of the rules; the envelope names them.
 */
export function envelope(model: string, scope: string | null, ruleIds: readonly string[], joined: string, triggers: readonly Trigger[] = []): string {
  const scopeAttr = scope !== null ? ` scope="${scope}"` : '';
  const scopeText = scope !== null ? `, task scope "${scope}"` : '';
  const triggerAttr = triggers.length ? ` trigger="${triggers.join(' ')}"` : '';
  const triggerText = triggers.length ? `, for ${triggers.map((t) => TRIGGER_TEXT[t]).join(' and ')}` : '';
  return (
    `<noonsight-rules model="${model}"${scopeAttr}${triggerAttr}>\n` +
    `Working rules the user declared for ${model}${scopeText}${triggerText} (delivered by noonsight, rules ${ruleIds.join(', ')}):\n` +
    `${joined}\n` +
    `</noonsight-rules>`
  );
}

/**
 * The note that says which working rules in the conversation no longer apply: those noonsight
 * delivered for every model in `retired`, after the session's model changed from `from` to `to`, or,
 * when `from` is null or `to` itself, while the session runs on `to`. Rules delivered earlier stay in
 * the conversation, so the model is told, as a fact, that they no longer apply. The `from` attribute
 * lists the retired models. Model names are cut to a fixed length, and when the list of retired
 * models would not fit, the note retires the rules of every model but `to`, so it always fits
 * SWITCH_NOTE_RESERVE.
 */
export function switchNote(from: string | null, to: string, retired: readonly string[] = from === null ? [] : [from]): string {
  const target = noteName(to);
  const change = from !== null && from !== to ? `The session's model changed from ${noteName(from)} to ${target}. ` : `This session runs on ${target}. `;
  const build = (attribute: string, names: string): string =>
    `<noonsight-rules-change from="${attribute}" to="${target}">\n` +
    change +
    `The working rules noonsight delivered earlier in this conversation for ${names} no longer apply.\n` +
    `</noonsight-rules-change>`;
  const names = [...new Set(retired.map(noteName))];
  const listed = build(names.join(' '), listText(names));
  const note = listed.length + 2 <= SWITCH_NOTE_RESERVE ? listed : build('*', `every model other than ${target}`);
  if (note.length + 2 > SWITCH_NOTE_RESERVE) throw new Error('switchNote: the note outgrew its reserve');
  return note;
}

/** "a", "a and b", "a, b and c". */
function listText(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/**
 * The note delivered when `noonsight run` put one model's rules in the system prompt and the session
 * runs on another model. Like switchNote, it states as a fact that those rules do not apply, and it
 * always fits SWITCH_NOTE_RESERVE.
 */
export function launcherNote(promptModel: string, sessionModel: string): string {
  const from = noteName(promptModel);
  const to = noteName(sessionModel);
  const note =
    `<noonsight-rules-change from="${from}" to="${to}">\n` +
    `This session runs on ${to}. ` +
    `The working rules for ${from} that noonsight added to the system prompt when it started the session do not apply.\n` +
    `</noonsight-rules-change>`;
  if (note.length + 2 > SWITCH_NOTE_RESERVE) throw new Error('launcherNote: the note outgrew its reserve');
  return note;
}

/** Joins the model-change note and the new model's rules into one delivery. */
export function joinDelivery(parts: readonly string[]): string {
  return parts.join('\n\n');
}

const NOTE_NAME_LENGTH = 48;
function noteName(model: string): string {
  const safe = model.replace(/[^a-z0-9._:@\[\]-]/gi, '?');
  return safe.length > NOTE_NAME_LENGTH ? `${safe.slice(0, NOTE_NAME_LENGTH - 3)}...` : safe || '(not reported)';
}

/** Whether the configuration declares a normalized model, by an exact key or a wildcard. */
export function declares(config: Config, model: string): boolean {
  return matchModel(config, model) !== null;
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
      ? `noonsight: model ${d.model ?? '(not reported)'} has no declared rules (${d.reason}, ${d.place})`
      : undefined;
  return { status: 'undeclared', ...d, ...(warning !== undefined ? { warning } : {}) };
}

function shortHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}
