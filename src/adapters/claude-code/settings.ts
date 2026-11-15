// sextant's entries in a Claude Code settings file. Pure functions over the parsed JSON: they add,
// repair or remove sextant's own hook handlers and never change anything else in the file.
//
// sextant recognizes its handlers by the program they run: a file named sextant-hook (the hook
// pointer), wherever it lives. Every other handler, matcher group and key belongs to someone else.

export const POINTER_NAME = 'sextant-hook';

/** The Claude Code events sextant handles, and the argument its hook command receives for each. */
export const HOOK_EVENTS = {
  SessionStart: 'session-start',
  PostModelSwitch: 'model-switch',
  PreToolUse: 'agent-call',
  PostToolUse: 'agent-result',
} as const;
export type HookEvent = keyof typeof HOOK_EVENTS;
export type HookArg = (typeof HOOK_EVENTS)[HookEvent];

/**
 * The names of the tool that starts a subagent. Claude Code calls it Agent; earlier versions called
 * it Task, and both names are valid (https://code.claude.com/docs/en/sub-agents).
 */
export const AGENT_TOOLS: readonly string[] = ['Agent', 'Task'];

/**
 * The matcher of each event's entry, or undefined for an entry with no matcher. The tool events only
 * run sextant for the agent tool, under either name; the hook checks the tool name again itself.
 */
export const HOOK_MATCHERS: Readonly<Record<HookEvent, string | undefined>> = {
  SessionStart: undefined,
  PostModelSwitch: undefined,
  PreToolUse: AGENT_TOOLS.join('|'),
  PostToolUse: AGENT_TOOLS.join('|'),
};

/**
 * Seconds before Claude Code cancels the hook. The hook itself takes a fraction of a second; the
 * limit only bounds a machine that has stopped responding, far below Claude Code's default of 600.
 */
export const HOOK_TIMEOUT_SECONDS = 10;

export interface CommandHandler {
  readonly type: 'command';
  readonly command: string;
  readonly args: readonly string[];
  readonly timeout: number;
}

/**
 * The handler for one event. It uses exec form (command plus args): no shell parses the path,
 * so a directory such as "Application Support" needs no quoting.
 */
export function handlerFor(pointer: string, event: HookEvent): CommandHandler {
  return { type: 'command', command: pointer, args: [HOOK_EVENTS[event]], timeout: HOOK_TIMEOUT_SECONDS };
}

/** A settings file whose shape sextant will not edit; the message names where the shape is wrong. */
export class SettingsShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettingsShapeError';
  }
}

type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isSextantHandler(handler: unknown): boolean {
  if (!isObject(handler) || typeof handler.command !== 'string') return false;
  const base = handler.command.split(/[\\/]/).pop();
  return base === POINTER_NAME;
}

export interface FoundHandler {
  readonly event: string;
  readonly matcher: unknown;
  readonly handler: JsonObject;
}

/** Every sextant handler in the file, in order. Parts of the file with an unexpected shape are skipped. */
export function findSextantHandlers(settings: unknown): FoundHandler[] {
  const found: FoundHandler[] = [];
  if (!isObject(settings) || !isObject(settings.hooks)) return found;
  for (const [event, groups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!isObject(group) || !Array.isArray(group.hooks)) continue;
      for (const handler of group.hooks)
        if (isSextantHandler(handler)) found.push({ event, matcher: group.matcher, handler: handler as JsonObject });
    }
  }
  return found;
}

export interface Edit {
  readonly settings: JsonObject;
  readonly changed: boolean;
}

/** The matcher group sextant adds for one event. */
export function groupFor(pointer: string, event: HookEvent): JsonObject {
  const matcher = HOOK_MATCHERS[event];
  return { ...(matcher !== undefined ? { matcher } : {}), hooks: [handlerFor(pointer, event)] };
}

/**
 * The settings with exactly one sextant handler per event, each in its own matcher group with the
 * event's matcher, pointing at the given pointer. Running it again on its own result changes nothing.
 */
export function withSextantHooks(settings: unknown, pointer: string): Edit {
  const base = checkShape(settings);
  const found = findSextantHandlers(base);
  const events = Object.keys(HOOK_EVENTS) as HookEvent[];
  const current =
    found.length === events.length &&
    events.every((event) => {
      const mine = found.filter((f) => f.event === event);
      const only = mine.length === 1 ? mine[0] : undefined;
      return only !== undefined && only.matcher === HOOK_MATCHERS[event] && sameHandler(only.handler, handlerFor(pointer, event));
    });
  if (current) return { settings: base, changed: false };

  const next = withoutSextantHooks(base).settings;
  const hooks = isObject(next.hooks) ? next.hooks : (next.hooks = {});
  for (const event of events) {
    const groups = Array.isArray(hooks[event]) ? (hooks[event] as unknown[]) : (hooks[event] = []);
    groups.push(groupFor(pointer, event));
  }
  return { settings: next, changed: true };
}

/**
 * The settings with every sextant handler removed. A matcher group, an event or the hooks object is
 * removed only when removing sextant's handlers is what left it empty.
 */
export function withoutSextantHooks(settings: unknown): Edit {
  const next = checkShape(settings);
  if (!isObject(next.hooks)) return { settings: next, changed: false };
  let changed = false;
  for (const [event, groups] of Object.entries(next.hooks)) {
    if (!Array.isArray(groups)) continue;
    const kept: unknown[] = [];
    let eventChanged = false;
    for (const group of groups) {
      if (!isObject(group) || !Array.isArray(group.hooks)) {
        kept.push(group);
        continue;
      }
      const handlers = group.hooks.filter((h) => !isSextantHandler(h));
      if (handlers.length === group.hooks.length) {
        kept.push(group);
        continue;
      }
      eventChanged = true;
      if (handlers.length > 0) kept.push({ ...group, hooks: handlers });
    }
    if (!eventChanged) continue;
    changed = true;
    if (kept.length > 0) next.hooks[event] = kept;
    else delete next.hooks[event];
  }
  if (changed && Object.keys(next.hooks).length === 0) delete next.hooks;
  return { settings: next, changed };
}

/** A deep copy of the settings, after checking the parts sextant edits have the documented shape. */
function checkShape(settings: unknown): JsonObject {
  if (!isObject(settings)) throw new SettingsShapeError('the file does not hold a JSON object');
  const copy = structuredClone(settings);
  if (copy.hooks === undefined) return copy;
  if (!isObject(copy.hooks)) throw new SettingsShapeError('"hooks" is not an object');
  for (const event of Object.keys(HOOK_EVENTS)) {
    const groups = copy.hooks[event];
    if (groups === undefined) continue;
    if (!Array.isArray(groups)) throw new SettingsShapeError(`"hooks.${event}" is not a list`);
    groups.forEach((group, i) => {
      if (!isObject(group) || !Array.isArray(group.hooks))
        throw new SettingsShapeError(`"hooks.${event}[${i}]" is not a matcher group with a "hooks" list`);
    });
  }
  return copy;
}

function sameHandler(a: JsonObject, b: CommandHandler): boolean {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b as unknown as JsonObject));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((k) => [k, sortKeys(value[k])]),
  );
}
