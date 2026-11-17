// noonsight's entries in a Claude Code settings file. Pure functions over the parsed JSON: they add,
// repair or remove noonsight's own hook handlers and never change anything else in the file.
//
// noonsight recognizes its handlers by the program they run: a file named noonsight-hook (the hook
// pointer), wherever it lives. Every other handler, matcher group and key belongs to someone else.

export const POINTER_NAME = 'noonsight-hook';

/**
 * The names of the tool that starts a subagent. Claude Code calls it Agent; earlier versions called
 * it Task, and both names are valid (https://code.claude.com/docs/en/sub-agents).
 */
export const AGENT_TOOLS: readonly string[] = ['Agent', 'Task'];

/**
 * The tools that edit a file, whose input names it in file_path. Claude Code 2.1.326 offers these two;
 * NotebookEdit edits notebooks, which are not code files to the code-edit trigger.
 */
export const EDIT_TOOLS: readonly string[] = ['Edit', 'Write'];

/**
 * The handlers noonsight installs, one matcher group each: the Claude Code event, the argument the hook
 * command receives, and for a tool event the tools its matcher names; an entry without tools has no
 * matcher and runs on every occurrence.
 *   - The agent tool entries run noonsight only for the agent tool, under either name.
 *   - SubagentStart matches on the subagent's type, and runs for every type.
 *   - The file edit entry runs after a successful Edit or Write, for the code-edit trigger.
 * The hook checks the tool name again itself, so a widened matcher reaches no other tool.
 */
export const HOOK_HANDLERS = [
  { event: 'SessionStart', arg: 'session-start', tools: undefined },
  { event: 'PostModelSwitch', arg: 'model-switch', tools: undefined },
  { event: 'PreToolUse', arg: 'agent-call', tools: AGENT_TOOLS },
  { event: 'SubagentStart', arg: 'subagent-start', tools: undefined },
  { event: 'PostToolUse', arg: 'agent-result', tools: AGENT_TOOLS },
  { event: 'PostToolUse', arg: 'file-edit', tools: EDIT_TOOLS },
] as const;
export type HookHandlerSpec = (typeof HOOK_HANDLERS)[number];
export type HookEvent = HookHandlerSpec['event'];
export type HookArg = HookHandlerSpec['arg'];

/** The matcher of an entry: its tools, or none. */
export function matcherOf(spec: HookHandlerSpec): string | undefined {
  return spec.tools?.join('|');
}

/** The Claude Code events noonsight handles, each once. */
export const HOOK_EVENTS: readonly HookEvent[] = [...new Set(HOOK_HANDLERS.map((h) => h.event))];

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
 * The handler for one entry. It uses exec form (command plus args): no shell parses the path,
 * so a directory such as "Application Support" needs no quoting.
 */
export function handlerFor(pointer: string, spec: HookHandlerSpec): CommandHandler {
  return { type: 'command', command: pointer, args: [spec.arg], timeout: HOOK_TIMEOUT_SECONDS };
}

/** A settings file whose shape noonsight will not edit; the message names where the shape is wrong. */
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

export function isNoonsightHandler(handler: unknown): boolean {
  if (!isObject(handler) || typeof handler.command !== 'string') return false;
  const base = handler.command.split(/[\\/]/).pop();
  return base === POINTER_NAME;
}

export interface FoundHandler {
  readonly event: string;
  readonly matcher: unknown;
  readonly handler: JsonObject;
}

/** Every noonsight handler in the file, in order. Parts of the file with an unexpected shape are skipped. */
export function findNoonsightHandlers(settings: unknown): FoundHandler[] {
  const found: FoundHandler[] = [];
  if (!isObject(settings) || !isObject(settings.hooks)) return found;
  for (const [event, groups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!isObject(group) || !Array.isArray(group.hooks)) continue;
      for (const handler of group.hooks)
        if (isNoonsightHandler(handler)) found.push({ event, matcher: group.matcher, handler: handler as JsonObject });
    }
  }
  return found;
}

export interface Edit {
  readonly settings: JsonObject;
  readonly changed: boolean;
}

/** The matcher group noonsight adds for one entry. */
export function groupFor(pointer: string, spec: HookHandlerSpec): JsonObject {
  const matcher = matcherOf(spec);
  return { ...(matcher !== undefined ? { matcher } : {}), hooks: [handlerFor(pointer, spec)] };
}

/** The found handlers that are exactly the entry for a spec: its event, matcher, and handler for this pointer. */
export function handlersFor(found: readonly FoundHandler[], spec: HookHandlerSpec, pointer: string): FoundHandler[] {
  return found.filter((f) => f.event === spec.event && f.matcher === matcherOf(spec) && sameHandler(f.handler, handlerFor(pointer, spec)));
}

/**
 * The settings with exactly one noonsight handler per entry of HOOK_HANDLERS, each in its own matcher
 * group with the entry's matcher, pointing at the given pointer. Running it again on its own result
 * changes nothing.
 */
export function withNoonsightHooks(settings: unknown, pointer: string): Edit {
  const base = checkShape(settings);
  const found = findNoonsightHandlers(base);
  const current = found.length === HOOK_HANDLERS.length && HOOK_HANDLERS.every((spec) => handlersFor(found, spec, pointer).length === 1);
  if (current) return { settings: base, changed: false };

  const next = withoutNoonsightHooks(base).settings;
  const hooks = isObject(next.hooks) ? next.hooks : (next.hooks = {});
  for (const spec of HOOK_HANDLERS) {
    const groups = Array.isArray(hooks[spec.event]) ? (hooks[spec.event] as unknown[]) : (hooks[spec.event] = []);
    groups.push(groupFor(pointer, spec));
  }
  return { settings: next, changed: true };
}

/**
 * The settings with every noonsight handler removed. A matcher group, an event or the hooks object is
 * removed only when removing noonsight's handlers is what left it empty.
 */
export function withoutNoonsightHooks(settings: unknown): Edit {
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
      const handlers = group.hooks.filter((h) => !isNoonsightHandler(h));
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

/** A deep copy of the settings, after checking the parts noonsight edits have the documented shape. */
function checkShape(settings: unknown): JsonObject {
  if (!isObject(settings)) throw new SettingsShapeError('the file does not hold a JSON object');
  const copy = structuredClone(settings);
  if (copy.hooks === undefined) return copy;
  if (!isObject(copy.hooks)) throw new SettingsShapeError('"hooks" is not an object');
  for (const event of HOOK_EVENTS) {
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
