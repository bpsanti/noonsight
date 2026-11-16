// The model a session was started with, for a SessionStart input that names none, as in every
// `claude -p` run. Claude Code picks the starting model from, in order
// (https://code.claude.com/docs/en/model-config, "Setting your model"):
//
//   1. the --model argument of the claude command;
//   2. the ANTHROPIC_MODEL environment variable;
//   3. the model setting of the highest-ranked settings file that sets one.
//
// The hook reads the same three: the command line of the Claude Code process that runs it (its
// parent), its own environment, which Claude Code passes to hooks with the settings' env applied, and
// the settings files Claude Code reads. The first source that names a model decides; a lower source
// is never consulted past it, because Claude Code would not consult it either.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Env } from '../../config/paths.js';
import { normalizeModel } from '../../core/normalize.js';
import { MODEL_ALIASES, PROVIDER_VARS, RUNTIME_MODEL_VALUES } from './compat.js';
import { defaultAccountDir, managedTarget } from './locations.js';
import { managedFilesApply, readManagedFiles, readRemoteSettings } from './managed.js';
import { isObject } from './settings.js';

/** Where the model came from, as the decision log records it. */
export type LaunchSource = 'claude-args' | 'env' | 'settings';

export type LaunchModel =
  | {
      readonly kind: 'found';
      /** The normalized model identifier. */
      readonly model: string;
      readonly source: LaunchSource;
      /** The exact origin: "--model", "ANTHROPIC_MODEL", "--settings" or a settings file. */
      readonly from: string;
      /** The alias the source named, when it named one. */
      readonly alias?: string;
      /** What resolved the alias: the environment variable that pins it, or "built-in". */
      readonly aliasFrom?: string;
    }
  | {
      /** A source decides the model, but noonsight cannot tell which model it selects. */
      readonly kind: 'unresolved';
      readonly value: string;
      readonly source: LaunchSource;
      readonly from: string;
      readonly why: string;
    }
  | { readonly kind: 'none' };

export interface LaunchContext {
  readonly env: Env;
  readonly home: string;
  /** The Claude Code process that runs the hook. */
  readonly pid: number;
  /** The session's working directory, from the hook input. */
  readonly cwd: string | null;
  readonly platform?: NodeJS.Platform;
  /** Reads the Claude Code command line instead of reading it from the process, so a caller can share one read. */
  readonly commandLine?: () => CommandLine | null;
}

export function launchModel(ctx: LaunchContext): LaunchModel {
  return launchModelFrom(ctx.commandLine ? ctx.commandLine() : readCommandLine(ctx.pid, ctx.platform ?? process.platform), ctx);
}

/**
 * The same choice for a known command line: the Claude Code arguments as the launcher is about to
 * pass them, or null when they cannot be read.
 */
export function launchModelFrom(cmd: CommandLine | null, ctx: Pick<LaunchContext, 'env' | 'home' | 'cwd'>): LaunchModel {
  const flag = cmd ? modelArgument(cmd, ctx.env) : null;
  if (flag !== null) return flag;

  const fromEnv = ctx.env.ANTHROPIC_MODEL;
  if (fromEnv) return resolveValue(fromEnv, 'env', 'ANTHROPIC_MODEL', ctx.env);

  return settingsModel(ctx, cmd);
}

/** A process's arguments. On macOS they come joined by spaces, so an argument holding a space is split. */
export interface CommandLine {
  readonly args: readonly string[];
  readonly exact: boolean;
}

/**
 * The command line of a process: /proc on Linux, which keeps argument boundaries, and `ps` on macOS,
 * which has no such file. Null when it cannot be read.
 */
export function readCommandLine(pid: number, platform: NodeJS.Platform): CommandLine | null {
  if (!Number.isSafeInteger(pid) || pid <= 1) return null;
  if (platform === 'linux') {
    try {
      const args = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
      if (args.at(-1) === '') args.pop();
      return args.length ? { args, exact: true } : null;
    } catch {
      return null;
    }
  }
  if (platform === 'darwin') {
    const r = spawnSync('/bin/ps', ['-ww', '-o', 'args=', '-p', String(pid)], { encoding: 'utf8', timeout: 2000 });
    const text = r.status === 0 ? r.stdout.trim() : '';
    return text ? { args: text.split(/\s+/), exact: false } : null;
  }
  return null;
}

/** Every value given to an option, as --name value or --name=value, up to a "--" that ends the options. */
function optionValues(cmd: CommandLine, name: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < cmd.args.length; i++) {
    const a = cmd.args[i] ?? '';
    if (a === '--' && cmd.exact) break;
    if (a === name) {
      const value = cmd.args[i + 1];
      if (value !== undefined) values.push(value);
      i++;
    } else if (a.startsWith(`${name}=`)) values.push(a.slice(name.length + 1));
  }
  return values;
}

/**
 * The values an option may have been given. On an exact command line, the last one, which Claude Code
 * uses. Without argument boundaries a prompt can hold the option's text too, so every distinct value is
 * a candidate, and more than one means the option cannot be read.
 */
export function optionCandidates(cmd: CommandLine, name: string): string[] {
  const values = optionValues(cmd, name);
  if (cmd.exact) return values.slice(-1);
  return [...new Set(values)];
}

const NO_BOUNDARIES = 'a command line read without argument boundaries cannot tell the option from prompt text';

/** A --setting-sources value: a comma-separated list of the settings files Claude Code may read. */
const SETTING_SOURCES = /^(?:user|project|local)(?:,(?:user|project|local))*$/;

/** Values that name a model: a Claude model identifier in any provider's form, or an alias. */
const LOOKS_LIKE_MODEL = new RegExp(
  `^(?:[a-z0-9._:@/-]*claude[a-z0-9._:@/-]*|${[...MODEL_ALIASES.map((a) => a.alias), ...RUNTIME_MODEL_VALUES].join('|')})(?:\\[1m\\])?$`,
  'i',
);

export function modelArgument(cmd: CommandLine, env: Env): LaunchModel | null {
  const values = optionCandidates(cmd, '--model');
  const value = values[0];
  if (value === undefined) return null;
  // Without argument boundaries, a value that names no Claude model may be prompt text or a custom
  // model identifier; either way a lower source would not decide, so it is reported instead.
  if (values.length > 1 || (!cmd.exact && !LOOKS_LIKE_MODEL.test(value)))
    return { kind: 'unresolved', value: values.join(' or '), source: 'claude-args', from: '--model', why: NO_BOUNDARIES };
  return resolveValue(value, 'claude-args', '--model', env);
}

/**
 * The model setting, from the settings Claude Code ranks highest
 * (https://code.claude.com/docs/en/settings, "Settings precedence"): managed settings, then
 * --settings, then the project's local and shared settings, then the user's.
 */
function settingsModel(ctx: Pick<LaunchContext, 'env' | 'home' | 'cwd'>, cmd: CommandLine | null): LaunchModel {
  const configDir = defaultAccountDir(ctx.env, ctx.home);

  // Managed: server-managed settings cached for this login, else the managed settings files.
  const remote = remoteSettingsApply(ctx.env) ? readRemoteSettings(configDir) : null;
  if (remote?.deliversPolicy && typeof remote.settings.model === 'string' && remote.settings.model)
    return resolveValue(remote.settings.model, 'settings', remote.file, ctx.env);
  if (managedFilesApply(remote)) {
    const managedDir = safeManagedDir(ctx.env);
    const files = managedDir ? readManagedFiles(managedDir) : null;
    if (files && typeof files.merged.model === 'string' && files.merged.model)
      return resolveValue(files.merged.model, 'settings', files.origins.model ?? managedDir ?? '', ctx.env);
  }

  // --settings: a file, or inline JSON.
  const inlines = cmd ? optionCandidates(cmd, '--settings') : [];
  if (inlines.length > 1)
    return { kind: 'unresolved', value: inlines.join(' or '), source: 'settings', from: '--settings', why: NO_BOUNDARIES };
  const inline = inlines[0];
  if (inline !== undefined) {
    const value = readSettingsArgument(inline);
    if (value === undefined)
      return { kind: 'unresolved', value: inline, source: 'settings', from: '--settings', why: 'noonsight could not read the --settings value' };
    if (value !== null) return resolveValue(value, 'settings', '--settings', ctx.env);
  }

  // --setting-sources narrows the files below to the ones it lists.
  const lists = cmd ? optionCandidates(cmd, '--setting-sources') : [];
  if (lists.length > 1 || (cmd !== null && !cmd.exact && lists.some((l) => !SETTING_SOURCES.test(l))))
    return { kind: 'unresolved', value: lists.join(' or '), source: 'settings', from: '--setting-sources', why: NO_BOUNDARIES };
  const listed = lists[0];
  const sources = listed === undefined ? null : new Set(listed.split(',').map((s) => s.trim()));
  const project = ctx.env.CLAUDE_PROJECT_DIR || ctx.cwd;
  const files: [string, string | null][] = [
    ['local', project ? path.join(project, '.claude', 'settings.local.json') : null],
    ['project', project ? path.join(project, '.claude', 'settings.json') : null],
    ['user', path.join(configDir, 'settings.json')],
  ];
  for (const [source, file] of files) {
    if (file === null || (sources !== null && !sources.has(source))) continue;
    const value = modelOf(readObject(file));
    if (value !== null) return resolveValue(value, 'settings', file, ctx.env);
  }
  return { kind: 'none' };
}

/**
 * Claude Code fetches server-managed settings only when the session talks to Anthropic's API
 * directly (https://code.claude.com/docs/en/managed-settings, "How Claude Code combines managed
 * sources"); behind another provider or another API address it starts at the next managed source.
 */
function remoteSettingsApply(env: Env): boolean {
  if (PROVIDER_VARS.some((v) => isSet(env[v]))) return false;
  if (!env.ANTHROPIC_BASE_URL) return true;
  try {
    return new URL(env.ANTHROPIC_BASE_URL).hostname === 'api.anthropic.com';
  } catch {
    return false;
  }
}

/** The model a --settings value sets: null when it sets none, undefined when it cannot be read. */
function readSettingsArgument(value: string): string | null | undefined {
  let parsed: unknown;
  if (value.trimStart().startsWith('{')) {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return undefined;
    }
  } else {
    parsed = readObject(value);
    if (parsed === null) return undefined;
  }
  return modelOf(parsed);
}

/**
 * The model a value selects. An alias resolves through the environment variable that pins it, and
 * otherwise, on the Anthropic API only, to the model the documentation names for it.
 */
export function resolveValue(value: string, source: LaunchSource, from: string, env: Env): LaunchModel {
  const r = resolveModelValue(value, env);
  if (r.kind === 'unresolved') return { kind: 'unresolved', value, source, from, why: r.why };
  return { kind: 'found', model: r.model, source, from, ...(r.aliasFrom !== undefined ? { alias: value, aliasFrom: r.aliasFrom } : {}) };
}

/** What the decision log records about a model taken from the session's start. */
export function launchFields(launch: LaunchModel | null): Record<string, unknown> {
  if (launch === null || launch.kind === 'none') return {};
  if (launch.kind === 'unresolved') return { model_from: launch.from, model_unresolved: launch.value, unresolved_why: launch.why };
  return {
    model_from: launch.from,
    ...(launch.alias !== undefined ? { model_alias: launch.alias, alias_from: launch.aliasFrom } : {}),
  };
}

export type ModelValue =
  | {
      readonly kind: 'found';
      readonly model: string;
      /** For an alias: what resolved it, the environment variable that pins it or "built-in". */
      readonly aliasFrom?: string;
    }
  | { readonly kind: 'unresolved'; readonly why: string };

/** The model a model setting, an alias or an identifier, selects; see resolveValue. */
export function resolveModelValue(value: string, env: Env): ModelValue {
  const bare = value.trim().replace(/\[1m\]$/i, '').toLowerCase();
  if (RUNTIME_MODEL_VALUES.includes(bare)) return { kind: 'unresolved', why: 'Claude Code chooses that model while the session runs' };
  const alias = MODEL_ALIASES.find((a) => a.alias === bare);
  if (alias) {
    const pinned = normalizeModel(env[alias.envVar]);
    if (pinned && !MODEL_ALIASES.some((a) => a.alias === pinned)) return { kind: 'found', model: pinned, aliasFrom: alias.envVar };
    const provider = otherProvider(env);
    if (provider) return { kind: 'unresolved', why: `the alias selects another model when ${provider} is set; set ${alias.envVar}` };
    return { kind: 'found', model: alias.model, aliasFrom: 'built-in' };
  }
  const model = normalizeModel(value);
  if (!model) return { kind: 'unresolved', why: 'it names no model' };
  return { kind: 'found', model };
}

/** The variable that moves Claude Code off the Anthropic API, or undefined when none is set. */
export function otherProvider(env: Env): string | undefined {
  return PROVIDER_VARS.find((v) => isSet(env[v]));
}

export function isSet(value: string | undefined): boolean {
  return value !== undefined && !['', '0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
}

function modelOf(settings: unknown): string | null {
  return isObject(settings) && typeof settings.model === 'string' && settings.model !== '' ? settings.model : null;
}

function readObject(file: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

function safeManagedDir(env: Env): string | null {
  try {
    return managedTarget(env).managedDir ?? null;
  } catch {
    return null;
  }
}
