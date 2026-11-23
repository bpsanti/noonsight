// What each declared model receives in each place when nothing gives it a scope, written out, as
// `noonsight install` and `noonsight check` say it: one line per model, a place with no rule written
// as "nothing" with the preset rules that are off there, then the two ways to change what a session
// receives.

import type { ConfigDetails } from '../config/load.js';
import { selectRules } from '../core/resolve.js';
import { PLACES, TRIGGERS, type ModelEntry, type Place, type Rule, type Trigger } from '../core/types.js';

/** How the lines name each place. */
export const PLACE_NAMES: Readonly<Record<Place, string>> = {
  attended: 'attended session',
  unattended: 'unattended session',
  subagent: 'subagent',
};

/** When a trigger adds its rules to a session, as the lines say it. */
const TRIGGER_WHEN: Readonly<Record<Trigger, string>> = {
  'code-edit': 'once it edits tracked code (code-edit)',
};

/** What the lines are written from: the configuration as loaded, and the preset its models draw from. */
export type ReceivesInput = Pick<ConfigDetails, 'config' | 'preset' | 'declared'>;

/**
 * One line per declared model: what it receives in each place with no scope, "nothing" where it
 * receives nothing. A place with nothing names the preset rules of the model that are off and are for
 * that place, and the line ends by saying how such a place gets rules.
 */
export function receivesLines(details: ReceivesInput): string[] {
  const { config } = details;
  return [
    ...[...config.exact].map(([key, entry]) => `${key}: ${describeEntry(entry, offRules(details, key, entry))}`),
    ...config.wildcards.map((w) => `${w.key}: nothing in any place, by decision ("use": "none" for every model it matches)`),
  ];
}

/** The two ways to change what a session receives: its place and its scope. */
export function changeLines({ config }: Pick<ConfigDetails, 'config'>): string[] {
  const { unattendedWhenEnv: names, headlessIsUnattended: headless } = config.session;
  const set = names.length ? ` (here: ${names.join(', ')})` : '';
  return [
    (headless
      ? 'A session is unattended when it runs headless, as `claude -p` and the Agent SDK do, or when a variable of `session.unattended_when_env` is set' +
        `${set}; set it to your CI's or orchestrator's variable so the interactive sessions nobody watches are unattended too.`
      : 'A session is unattended only when a variable of `session.unattended_when_env` is set' +
        `${set}, because \`session.headless_is_unattended\` is false; set it to your CI's or orchestrator's variable for the sessions nobody watches.`),
    'A rule limited to scopes adds to these only in one of its scopes: a session takes its scope from `NOONSIGHT_SCOPE` or `noonsight run --scope`, ' +
      'a subagent from its task; `noonsight models` lists every rule with its scopes and places.',
  ];
}

/**
 * The preset rules of a model declared with "use": "preset" that it does not receive: those that ship
 * off and are not enabled, and those disabled. A rule another one replaces is not off: the rule that
 * replaces it is delivered in its place.
 */
function offRules({ preset, declared }: ReceivesInput, key: string, entry: ModelEntry): Rule[] {
  if (entry.use !== 'rules' || declared.get(key)?.use !== 'preset') return [];
  const on = new Set(entry.rules.flatMap((r) => (r.origin === 'preset' ? [r.id] : r.replaces !== undefined ? [r.replaces] : [])));
  return (preset?.models.get(key) ?? []).filter((r) => !on.has(r.id));
}

function describeEntry(entry: ModelEntry, off: readonly Rule[]): string {
  if (entry.use === 'none') return 'nothing in any place, by decision ("use": "none")';
  const places = PLACES.map((place) => ({ place, always: selectRules(entry.rules, null, place) }));
  const line = places.map(({ place, always }) => `${PLACE_NAMES[place]}: ${describePlace(entry.rules, place, always, off)}`).join('; ');
  const empty = places.filter(({ always }) => always.length === 0).map(({ place }) => place);
  if (empty.length === 0) return line;
  const offThere = off.some((r) => r.where.some((p) => empty.includes(p)));
  return (
    `${line}. Your own rules without "where" are delivered in every place, the ${empty.map((p) => PLACE_NAMES[p]).join(' and ')} included` +
    `${offThere ? '; "enable" turns on a rule that is off' : ''}.`
  );
}

/**
 * The rules for every scope in a place, then those a trigger adds to a session; triggers act only in
 * a session. A place with no rule for every scope names the rules that are off there, for any scope.
 */
function describePlace(rules: readonly Rule[], place: Place, always: readonly Rule[], off: readonly Rule[]): string {
  const offHere = off.filter((r) => r.where.includes(place));
  const parts = [always.length ? ids(always) : offHere.length ? `nothing (off: ${ids(offHere)})` : 'nothing'];
  if (place !== 'subagent')
    for (const t of TRIGGERS) {
      const added = selectRules(rules, null, place, [t]).filter((r) => !always.includes(r));
      if (added.length) parts.push(`then ${ids(added)} ${TRIGGER_WHEN[t]}`);
    }
  return parts.join(', ');
}

function ids(rules: readonly Rule[]): string {
  return rules.map((r) => r.id).join(', ');
}
