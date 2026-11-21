// What each declared model receives in each place when nothing gives it a scope, written out, as
// `noonsight install` and `noonsight check` say it: one line per model, a place with no rule written
// as "nothing", then the two ways to change what a session receives.

import { selectRules } from '../core/resolve.js';
import { PLACES, TRIGGERS, type Config, type ModelEntry, type Place, type Rule, type Trigger } from '../core/types.js';

/** How the lines name each place. */
export const PLACE_NAMES: Readonly<Record<Place, string>> = {
  session: 'watched session',
  unattended: 'unattended session',
  subagent: 'subagent',
};

/** When a trigger adds its rules to a session, as the lines say it. */
const TRIGGER_WHEN: Readonly<Record<Trigger, string>> = {
  'code-edit': 'once it edits tracked code (code-edit)',
};

/** One line per declared model: what it receives in each place with no scope, "nothing" where it receives nothing. */
export function receivesLines(config: Config): string[] {
  return [
    ...[...config.exact].map(([key, entry]) => `${key}: ${describeEntry(entry)}`),
    ...config.wildcards.map((w) => `${w.key}: nothing in any place, by decision ("use": "none" for every model it matches)`),
  ];
}

/** The two ways to change what a session receives: its place and its scope. */
export function changeLines(config: Config): string[] {
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

function describeEntry(entry: ModelEntry): string {
  if (entry.use === 'none') return 'nothing in any place, by decision ("use": "none")';
  return PLACES.map((place) => `${PLACE_NAMES[place]}: ${describePlace(entry.rules, place)}`).join('; ');
}

/** The rules for every scope in a place, then those a trigger adds to a session; triggers act only in a session. */
function describePlace(rules: readonly Rule[], place: Place): string {
  const always = selectRules(rules, null, place);
  const parts = [always.length ? ids(always) : 'nothing'];
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
