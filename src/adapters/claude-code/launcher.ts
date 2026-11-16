// The launcher, `sextant run`: it starts Claude Code with the rules for the session's model in the
// system prompt, through --append-system-prompt-file, and passes every other argument unchanged.
//
// It decides exactly as the SessionStart hook does for a session that reports no model: the model
// Claude Code will start with, read from the arguments it is about to pass, ANTHROPIC_MODEL and the
// settings files (launch.ts); the scope from SEXTANT_SCOPE; the place from session.unattended_when_env.
// So when the hooks are installed too, SessionStart finds the same rules already in the system prompt
// and does not deliver them a second time (launcherPrompt below).
//
// Without SEXTANT_SCOPE, the scope comes from the task text, --task or the prompt after -p, through
// the scopes' matchers or, with classifier.mode on, the classifier (classifier.ts), and is passed on
// to the session as SEXTANT_SCOPE so its hooks decide alike.
// SEXTANT_SCOPE_VIA says where the scope came from: a sextant run started inside that session reads an
// inherited scope that was inferred from the outer task as no scope, and takes one from its own task.
// With routing on for the launcher, the scope's row adds --model and --effort before anything else is
// decided, so the rules are the routed model's.
//
// Claude Code keeps only the last --append-system-prompt-file it is given, while an
// --append-system-prompt adds to it. So a file someone else passes is merged into the launcher's
// file, ahead of the rules, and an --append-system-prompt is left as it is.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Env } from '../../config/paths.js';
import { resolve, scopeChangesRules } from '../../core/resolve.js';
import { route, routeReadsScope, type Held, type RouteDecision } from '../../core/route.js';
import { sessionPlace, sessionScope, SCOPE_ENV, taskScope, taskText, type ScopeChoice } from '../../core/scope.js';
import type { Config, Decision } from '../../core/types.js';
import { classifiedScope } from './classifier.js';
import { launchFields, launchModelFrom, modelArgument, optionCandidates, type CommandLine } from './launch.js';
import { launcherTranslation, routeFields } from './routing.js';
import { choiceFields, decisionFields } from './subagents.js';

/** Names, for the session and its hooks, the system prompt file the launcher passed. */
export const LAUNCH_FILE_ENV = 'SEXTANT_LAUNCH_FILE';

/** Where the launcher's SEXTANT_SCOPE came from: explicit (--scope or an explicit SEXTANT_SCOPE) or inferred (the task text). */
export const SCOPE_VIA_ENV = 'SEXTANT_SCOPE_VIA';

type ScopeVia = 'explicit' | 'inferred';

export const APPEND_FILE_OPTION = '--append-system-prompt-file';

/** The subdirectory of the state directory that holds the launcher's system prompt files. */
export const LAUNCH_DIR = 'launch';

export interface LaunchRequest {
  /** The arguments for claude, as given. */
  readonly args: readonly string[];
  /** The --scope option, or null to keep an explicit SEXTANT_SCOPE the launcher was started with. */
  readonly scope: string | null;
  /** The --task option, or null to read the task from the prompt after -p. */
  readonly task: string | null;
  readonly env: Env;
  readonly home: string;
  /** The directory Claude Code will start in. */
  readonly cwd: string;
  /** The account's state directory. */
  readonly state: string;
}

export interface LaunchPlan {
  /** The arguments to start claude with. */
  readonly args: readonly string[];
  /** What to start claude with if the system prompt file cannot be written: the route and the scope, no rules. */
  readonly fallback: Pick<LaunchPlan, 'args' | 'env'>;
  /** Changes to the environment claude starts with: a value to set, or undefined to remove. */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** The system prompt file to write before claude starts, when there are rules to add. */
  readonly file: { readonly path: string; readonly content: string } | null;
  /** The decision log line. */
  readonly record: Record<string, unknown>;
  /** Warnings for the person. */
  readonly messages: readonly string[];
}

/**
 * What the launcher adds when it adds no rules: the scope with where it came from, and no system prompt
 * file inherited from an outer launch. Without a scope of its own, a scope an outer launcher inferred
 * from its task is removed, while an explicit one is kept.
 */
export function passThrough(args: readonly string[], scope: string | null, env: Env, via: ScopeVia = 'explicit'): Pick<LaunchPlan, 'args' | 'env'> {
  const scopeEnv =
    scope !== null
      ? { [SCOPE_ENV]: scope, [SCOPE_VIA_ENV]: via }
      : env[SCOPE_VIA_ENV] === 'inferred'
        ? { [SCOPE_ENV]: undefined, [SCOPE_VIA_ENV]: undefined }
        : {};
  return { args: [...args], env: { [LAUNCH_FILE_ENV]: undefined, ...scopeEnv } };
}

/** Decide what the launcher adds to a claude command line. Reads only local files, and may ask the classifier; writes nothing. */
export function planLaunch(config: Config, configFile: string, req: LaunchRequest): LaunchPlan {
  const given: CommandLine = { args: req.args, exact: true };
  const held: Held | null = modelArgument(given, req.env) !== null ? { reason: 'explicit-model', explicit: true } : null;
  const explicitEnv = applyEnv(req.env, passThrough(req.args, req.scope, req.env).env);
  const chosen = launchScope(config, explicitEnv, req.task, given);
  const taskInput = chosen.source === 'env' ? null : (req.task ?? printPrompt(req.args));
  const classified = classifiedScope(config, {
    chosen,
    text: taskInput !== null ? taskText(null, taskInput).text : null,
    matters: () => {
      if (routeReadsScope(config, { target: 'launcher', env: req.env, held })) return true;
      const before = launchModelFrom(given, { env: explicitEnv, home: req.home, cwd: req.cwd });
      return before.kind !== 'found' || scopeChangesRules(config, before.model, sessionPlace(config, explicitEnv).place);
    },
    env: req.env,
  });
  const scope = classified.scope;
  const routed = route(config, {
    target: 'launcher',
    scope: scope.scope,
    env: req.env,
    held,
    explicitEffort: optionCandidates(given, EFFORT_OPTION).length > 0,
    translate: launcherTranslation(req.env),
  });
  const args = routedArgs(req.args, routed);
  // A scope from the task text, by a matcher or the classifier, is passed on, so the session's hooks decide with the same scope.
  const inferred = scope.source === 'task-text' || scope.source === 'classifier';
  const base = inferred ? passThrough(args, scope.scope, req.env, 'inferred') : passThrough(args, req.scope, req.env);
  const env = applyEnv(req.env, base.env);
  const place = sessionPlace(config, env);
  const cmd: CommandLine = { args, exact: true };
  const launch = launchModelFrom(cmd, { env, home: req.home, cwd: req.cwd });
  const decision = resolve(config, { model: launch.kind === 'found' ? launch.model : null, scope: scope.scope, place: place.place });
  const fields = {
    ...decisionFields(decision),
    ...choiceFields(scope, place),
    ...classified.fields,
    model_source: launch.kind === 'found' ? launch.source : null,
    ...launchFields(launch),
    ...routeFields(routed, env),
  };
  const messages = [
    ...(classified.failure !== null ? [`sextant: the classifier could not place the task (${classified.failure}), so the session has no scope.`] : []),
    ...undeclaredMessages(decision, configFile),
  ];
  const nothing = (extra: Record<string, unknown> = {}, more: readonly string[] = []): LaunchPlan => ({
    ...base,
    fallback: base,
    file: null,
    record: { ...fields, ...extra, delivered: 'nothing', warned: messages.length + more.length > 0 },
    messages: [...messages, ...more],
  });
  if (decision.status !== 'matched') return nothing();

  // The file someone else gave: the last one is the one Claude Code would have used.
  const theirs = optionCandidates(cmd, APPEND_FILE_OPTION)[0];
  let prefix = '';
  if (theirs !== undefined) {
    try {
      prefix = fs.readFileSync(path.resolve(req.cwd, theirs), 'utf8').replace(/\s+$/, '');
    } catch (e) {
      const why = (e as NodeJS.ErrnoException).code ?? String(e);
      return nothing({ merge_failed: theirs }, [
        `sextant: could not read ${theirs}, given to ${APPEND_FILE_OPTION} (${why}), so sextant run added no rules to the system prompt.`,
      ]);
    }
  }
  const content = `${prefix ? `${prefix}\n\n` : ''}${decision.text}\n`;
  const file = path.join(req.state, LAUNCH_DIR, `${createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16)}.md`);
  return {
    args: [APPEND_FILE_OPTION, file, ...withoutOption(args, APPEND_FILE_OPTION)],
    env: { ...base.env, [LAUNCH_FILE_ENV]: file },
    fallback: base,
    file: { path: file, content },
    record: { ...fields, delivered: 'system-prompt', launch_file: file, ...(theirs !== undefined ? { merged_file: theirs } : {}), warned: messages.length > 0 },
    messages,
  };
}

const MODEL_OPTION = '--model';
const EFFORT_OPTION = '--effort';

/**
 * The session's scope: SEXTANT_SCOPE (from --scope or an explicit one in the environment), else the scope whose matcher
 * matches earliest in the task text, --task or the prompt after -p.
 */
function launchScope(config: Config, env: Env, task: string | null, cmd: CommandLine): ScopeChoice {
  const explicit = sessionScope(env);
  if (explicit.scope !== null) return explicit;
  const text = task ?? printPrompt(cmd.args);
  return text !== null ? taskScope(config, taskText(null, text).text) : explicit;
}

/**
 * The prompt of `claude -p "<prompt>"`: the argument right after -p or --print, when it is not an
 * option. A prompt written elsewhere on the command line, or given on standard input, is not read.
 */
export function printPrompt(args: readonly string[]): string | null {
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? '';
    if (a === '--') return null;
    if (a === '-p' || a === '--print') {
      const next = args[i + 1];
      return next !== undefined && !next.startsWith('-') && next.trim() !== '' ? next : null;
    }
  }
  return null;
}

/**
 * The claude arguments with a route applied: --model and --effort first, replacing any the command line
 * gave, which happens only when routing.respect_explicit is false or the effort is not kept.
 */
function routedArgs(args: readonly string[], routed: RouteDecision): string[] {
  if (routed.routing !== 'routed') return [...args];
  let rest = withoutOption(args, MODEL_OPTION);
  const added = [MODEL_OPTION, routed.value];
  if (routed.effort !== undefined) {
    rest = withoutOption(rest, EFFORT_OPTION);
    added.push(EFFORT_OPTION, routed.effort);
  }
  return [...added, ...rest];
}

/** The arguments with every value of an option taken out, up to a "--" that ends the options. */
export function withoutOption(args: readonly string[], name: string): string[] {
  const kept: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? '';
    if (a === '--') {
      kept.push(...args.slice(i));
      break;
    }
    if (a === name) i++;
    else if (!a.startsWith(`${name}=`)) kept.push(a);
  }
  return kept;
}

export function applyEnv(env: Env, changes: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined) out[k] = v;
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined) delete out[k];
    else out[k] = v;
  }
  return out;
}

function undeclaredMessages(decision: Decision, file: string): string[] {
  // A session whose model the launcher cannot tell is left to the hooks, which see what Claude Code reports.
  if (decision.status !== 'undeclared' || decision.warning === undefined || decision.reason !== 'no-entry') return [];
  return [
    `sextant: ${decision.model} is not declared in ${file}, so sextant run added no rules. ` +
      'Declare it under "models" (with "use": "none" if it needs no rules).',
  ];
}

/** The system prompt text sextant run gave this Claude Code process. */
export interface LauncherPrompt {
  readonly file: string;
  readonly content: string;
  /** The model the rules in it are for, or null when it holds no rules. */
  readonly model: string | null;
}

/**
 * The text sextant run put in this session's system prompt, or null when it put none. The variable
 * alone is not enough: a claude started from inside a launched session inherits it without the
 * option, so the Claude Code command line must pass the same file.
 */
export function launcherPrompt(env: Env, commandLine: () => CommandLine | null): LauncherPrompt | null {
  const file = env[LAUNCH_FILE_ENV];
  if (!file) return null;
  const cmd = commandLine();
  if (cmd === null) return null;
  const given = optionCandidates(cmd, APPEND_FILE_OPTION);
  if (given.length !== 1 || given[0] !== file) return null;
  let content: string;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const models = [...content.matchAll(/<sextant-rules model="([^"]*)"/g)];
  return { file, content, model: models.at(-1)?.[1] || null };
}
