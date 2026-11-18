// What a preset update changes for a configuration. The configuration records the preset version it
// was checked against ("preset_version"); the package ships the installed version and keeps a copy of
// each earlier one, so the rules each model declared with "use": "preset" receives can be compared
// rule by rule: rules turned on or off, renamed, or changed, changes a rule that replaces a preset
// rule takes from it, and enable, disable or replaces entries that no longer name a rule. noonsight
// check, noonsight accept and the session-start warning all read it.

import type { Env } from './paths.js';
import {
  readPresetVersion,
  type DeclaredModel,
  type InheritedKey,
  type LoadOptions,
  type Preset,
  type PresetRule,
  type PresetVersions,
} from './load.js';

/** What the installed version changes for one model declared with "use": "preset". */
export interface ModelChanges {
  readonly model: string;
  /** The installed version has no rules for the model, so the configuration cannot take it as it is. */
  readonly dropped: boolean;
  /** Rules the model receives now and did not: a new rule that ships on, or one that ships on now. */
  readonly nowOn: readonly { readonly id: string; readonly why: 'new' | 'ships-on' }[];
  /** Rules the model received and no longer does: a removed rule, or one that ships off now. */
  readonly nowOff: readonly { readonly id: string; readonly why: 'removed' | 'ships-off' }[];
  readonly renamed: readonly { readonly from: string; readonly to: string }[];
  /** Rules on in both versions whose text, scopes, places or triggers changed. */
  readonly changed: readonly { readonly id: string; readonly what: readonly ('text' | 'scopes' | 'places' | 'triggers')[] }[];
  /** Replaced rules whose scopes, places or triggers changed, which the user rule `by` that replaces each takes from it. */
  readonly inherited: readonly { readonly id: string; readonly by: string; readonly what: readonly InheritedKey[] }[];
  /** New rules that ship off. */
  readonly newOff: readonly string[];
  /** Entries that do not name a rule of the installed version: `now` is the rule's id after a rename, or null when it is gone. */
  readonly staleEntries: readonly StaleEntry[];
}

/** An enable or disable entry, or the "replaces" of the user rule `rule`, that does not name a rule of the installed version. */
export type StaleEntry =
  | { readonly list: 'enable' | 'disable'; readonly id: string; readonly now: string | null }
  | { readonly list: 'replaces'; readonly rule: string; readonly id: string; readonly now: string | null };

export interface PresetComparison {
  readonly name: string;
  /** The configuration's "preset_version", or null when it records none. */
  readonly accepted: string | null;
  readonly installed: Preset;
  /** The accepted version, or null when the configuration records none or the package keeps no copy of it. */
  readonly from: Preset | null;
  /** Whether sessions keep the accepted version's rules ("hold") while another version is installed. */
  readonly held: boolean;
  /** The models with a change, in the order the configuration declares them. */
  readonly models: readonly ModelChanges[];
}

/**
 * Compare the accepted version with the installed one for every model declared with "use": "preset",
 * or only `only`. Without an accepted version the package keeps, the installed version is compared
 * with itself, which still finds entries that name a rule by an id it had before a rename. Returns
 * null when the preset is not installed. A kept copy that fails its checks throws a ConfigError.
 */
export function comparePresets(
  versions: PresetVersions,
  declared: ReadonlyMap<string, DeclaredModel>,
  options: LoadOptions = {},
  env: Env = process.env,
  only?: string,
): PresetComparison | null {
  const installed = versions.installed;
  if (installed === null) return null;
  const from = versions.accepted === null ? null : readPresetVersion(versions.name, versions.accepted, options, env);
  const base = from ?? installed;
  const models: ModelChanges[] = [];
  for (const [model, entry] of declared) {
    if (entry.use !== 'preset' || entry.wildcard || (only !== undefined && model !== only)) continue;
    const changes = modelChanges(model, base.models.get(model) ?? [], installed.models.get(model), entry);
    if (hasChanges(changes)) models.push(changes);
  }
  return {
    name: versions.name,
    accepted: versions.accepted,
    installed,
    from,
    held: versions.onChange === 'hold' && versions.accepted !== null && versions.accepted !== installed.version,
    models,
  };
}

/** Whether the comparison names a version change, as opposed to entries alone. */
export function versionChanged(c: PresetComparison): boolean {
  return c.accepted !== null && c.accepted !== c.installed.version;
}

export function hasChanges(m: ModelChanges): boolean {
  return m.dropped || [m.nowOn, m.nowOff, m.renamed, m.changed, m.inherited, m.newOff, m.staleEntries].some((list) => list.length > 0);
}

/** Whether the change alters what the model is delivered, or drops a choice the user made. */
export function changesDelivery(m: ModelChanges): boolean {
  return (
    m.dropped ||
    m.nowOn.length > 0 ||
    m.nowOff.length > 0 ||
    m.changed.length > 0 ||
    m.inherited.length > 0 ||
    m.staleEntries.some((e) => e.now === null)
  );
}

function modelChanges(model: string, from: readonly PresetRule[], to: readonly PresetRule[] | undefined, entry: DeclaredModel): ModelChanges {
  const empty = { nowOn: [], nowOff: [], renamed: [], changed: [], inherited: [], newOff: [], staleEntries: [] };
  if (to === undefined) return { model, dropped: true, ...empty };
  const predecessor = (r: PresetRule): PresetRule | undefined =>
    from.find((p) => p.id === r.id) ?? from.find((p) => r.renamedFrom.includes(p.id));
  const asBefore = (id: string): string => {
    if (from.some((p) => p.id === id || p.renamedFrom.includes(id))) return id;
    const r = to.find((r) => r.id === id || r.renamedFrom.includes(id));
    return (r === undefined ? undefined : predecessor(r)?.id) ?? id;
  };
  // A replaced rule is off, as a disabled one is.
  const replacing = entry.add.flatMap((u) => (u.replaces === undefined ? [] : [{ rule: u.id, ...u.replaces }]));
  const enable = entry.enable;
  const off = [...entry.disable, ...replacing.map((x) => x.id)];
  const onBefore = onRules(from, enable.map(asBefore), off.map(asBefore));
  const onAfter = onRules(to, enable, off);
  const successor = (p: PresetRule): PresetRule | undefined => to.find((r) => predecessor(r) === p);

  const nowOn: ModelChanges['nowOn'][number][] = [];
  const renamed: ModelChanges['renamed'][number][] = [];
  const changed: ModelChanges['changed'][number][] = [];
  const newOff: string[] = [];
  for (const r of to) {
    const p = predecessor(r);
    if (p !== undefined && p.id !== r.id) renamed.push({ from: p.id, to: r.id });
    if (onAfter.has(r.id)) {
      if (p === undefined) nowOn.push({ id: r.id, why: 'new' });
      else if (!onBefore.has(p.id)) nowOn.push({ id: r.id, why: 'ships-on' });
      else {
        const what = differences(p, r);
        if (what.length) changed.push({ id: r.id, what });
      }
    } else if (p === undefined) newOff.push(r.id);
  }
  const nowOff: ModelChanges['nowOff'][number][] = [];
  for (const p of from) {
    if (!onBefore.has(p.id)) continue;
    const r = successor(p);
    if (r === undefined) nowOff.push({ id: p.id, why: 'removed' });
    else if (!onAfter.has(r.id)) nowOff.push({ id: r.id, why: 'ships-off' });
  }

  // A rule that replaces a preset rule takes the keys it does not give from that rule, so their changes reach it.
  const inherited: ModelChanges['inherited'][number][] = [];
  for (const x of replacing) {
    const r = to.find((r) => r.id === x.id || r.renamedFrom.includes(x.id));
    const p = r === undefined ? undefined : predecessor(r);
    if (r === undefined || p === undefined) continue;
    const what = differences(p, r).filter((w): w is InheritedKey => w !== 'text' && x.inherits.includes(w));
    if (what.length) inherited.push({ id: r.id, by: x.rule, what });
  }

  const ids = new Set(to.map((r) => r.id));
  const now = (id: string): string | null => to.find((r) => r.renamedFrom.includes(id))?.id ?? null;
  const staleEntries: StaleEntry[] = [];
  for (const [list, entries] of [['enable', enable], ['disable', entry.disable]] as const)
    for (const id of entries) if (!ids.has(id)) staleEntries.push({ list, id, now: now(id) });
  for (const x of replacing) if (!ids.has(x.id)) staleEntries.push({ list: 'replaces', rule: x.rule, id: x.id, now: now(x.id) });
  return { model, dropped: false, nowOn, nowOff, renamed, changed, inherited, newOff, staleEntries };
}

/** The ids of the rules that are on, with the entries mapped through renames. */
function onRules(rules: readonly PresetRule[], enable: readonly string[], disable: readonly string[]): Set<string> {
  const current = (id: string): string | undefined => rules.find((r) => r.id === id)?.id ?? rules.find((r) => r.renamedFrom.includes(id))?.id;
  const on = new Set(enable.map(current));
  const off = new Set(disable.map(current));
  return new Set(rules.filter((r) => (r.enabled || on.has(r.id)) && !off.has(r.id)).map((r) => r.id));
}

function differences(a: PresetRule, b: PresetRule): ModelChanges['changed'][number]['what'] {
  const same = (x: readonly string[], y: readonly string[]): boolean => x.length === y.length && x.every((v, i) => v === y[i]);
  return [
    ...(a.text !== b.text ? (['text'] as const) : []),
    ...(!same(a.scopes, b.scopes) ? (['scopes'] as const) : []),
    ...(!same(a.where, b.where) ? (['places'] as const) : []),
    ...(!same(a.triggers, b.triggers) ? (['triggers'] as const) : []),
  ];
}

/**
 * One model's changes, as one line. Held, the changes are those accepting the installed version would
 * bring, so the entries are named as they would read then.
 */
export function describeChanges(m: ModelChanges, held = false): string {
  if (m.dropped)
    return `the installed preset has no rules for it${held ? '' : ' any more'}; declare it with "use": "custom" or "use": "none"${held ? ' before accepting it' : ''}`;
  const parts: string[] = [];
  if (m.nowOn.length) parts.push(`now on: ${m.nowOn.map((r) => `${r.id} (${r.why === 'new' ? 'new' : 'ships on now'})`).join(', ')}`);
  if (m.nowOff.length) parts.push(`now off: ${m.nowOff.map((r) => `${r.id} (${r.why === 'removed' ? 'removed' : 'ships off now'})`).join(', ')}`);
  if (m.renamed.length) parts.push(`renamed: ${m.renamed.map((r) => `${r.from} to ${r.to}`).join(', ')}`);
  if (m.changed.length) parts.push(`changed: ${m.changed.map((r) => `${r.id} (${r.what.join(', ')})`).join(', ')}`);
  for (const r of m.inherited) parts.push(`changed in a replaced rule: ${r.id} (${r.what.join(', ')}), which ${r.by} takes`);
  if (m.newOff.length) parts.push(`new and off unless enabled: ${m.newOff.join(', ')}`);
  for (const e of m.staleEntries) parts.push(describeStale(e, held));
  return parts.join('; ');
}

/** An entry that no longer names a rule of the installed version, as one part of a line. */
function describeStale(e: StaleEntry, held: boolean): string {
  if (e.list === 'replaces') return describeStaleReplaces(e.rule, e.id, e.now, held);
  if (e.now !== null)
    return held
      ? `"${e.list}" names "${e.id}", which the installed preset renames "${e.now}"; it will still apply to it, and after accepting, "${e.now}" is the name to write`
      : `"${e.list}" names "${e.id}", which is now "${e.now}"; it still applies to it, and "${e.now}" is the name to write`;
  return held
    ? `"${e.list}" names "${e.id}", which the installed preset no longer has; remove it before accepting`
    : `"${e.list}" names "${e.id}", which the preset no longer has, so that choice no longer applies; remove it`;
}

/** A "replaces" that no longer names a rule of the installed version, as one part of a line. */
function describeStaleReplaces(rule: string, id: string, now: string | null, held: boolean): string {
  const lead = `rule "${rule}" replaces "${id}", which`;
  if (now !== null)
    return held
      ? `${lead} the installed preset renames "${now}"; it will still replace it, and after accepting, "${now}" is the name to write`
      : `${lead} is now "${now}"; it still replaces it, and "${now}" is the name to write`;
  const keep = `write in "${rule}" any scopes, places or triggers it took from "${id}" and should keep`;
  return held
    ? `${lead} the installed preset no longer has; remove "replaces" before accepting, and ${keep}`
    : `${lead} the preset no longer has; "${rule}" is still delivered, after the rules of "all_models", with what it took from "${id}"; remove "replaces", and ${keep}`;
}
