// The plugins Claude Code installed from a marketplace, as its own files record them
// (https://code.claude.com/docs/en/plugins/loading): plugins/installed_plugins.json in the configuration
// directory lists each install, and enabledPlugins in the settings says which are on. noonsight reads
// them to find subagent definitions and to find itself installed as a plugin.

import fs from 'node:fs';
import path from 'node:path';
import { PACKAGE_ROOT, type Env } from '../../config/paths.js';
import { optionValues, readObject, remoteSettingsApply, safeManagedDir, settingSources, settingsArgument, type CommandLine } from './launch.js';
import { managedFilesApply, readManagedFiles, readRemoteSettings } from './managed.js';
import { isObject } from './settings.js';

/** The name noonsight's plugin and marketplace have. */
export const PLUGIN_NAME = 'noonsight';

export interface PluginPlaces {
  /** The session's project directory, or null when there is none. */
  readonly projectDir: string | null;
  /** The Claude Code configuration directory of the account. */
  readonly configDir: string;
  readonly env: Env;
}

export interface InstalledPlugin {
  /** plugin@marketplace. */
  readonly id: string;
  readonly name: string;
  readonly dir: string;
  readonly scope: string;
}

/**
 * The plugins installed from a marketplace that apply to the project. installed_plugins.json lists each
 * install as plugin@marketplace with its scope and folder; a project or local install applies only to
 * its own project.
 */
export function installedPlugins(places: PluginPlaces): InstalledPlugin[] {
  const registry = readObject(path.join(places.configDir, 'plugins', 'installed_plugins.json'));
  const plugins = registry !== null && isObject(registry.plugins) ? registry.plugins : null;
  if (plugins === null) return [];
  const project = places.projectDir === null ? null : realpath(path.resolve(places.projectDir));
  const found: InstalledPlugin[] = [];
  for (const [id, installs] of Object.entries(plugins)) {
    if (!Array.isArray(installs)) continue;
    const name = id.split('@')[0] ?? id;
    for (const install of installs) {
      if (!isObject(install) || typeof install.installPath !== 'string') continue;
      const scope = typeof install.scope === 'string' ? install.scope : 'user';
      if ((scope === 'project' || scope === 'local') && (typeof install.projectPath !== 'string' || realpath(install.projectPath) !== project)) continue;
      found.push({ id, name, dir: install.installPath, scope });
    }
  }
  return found;
}

/**
 * The plugins the settings turn on or off: enabledPlugins is read from the managed settings, the user's,
 * the project's, its local settings and --settings, in that order, a later value winning.
 */
export function enabledPlugins(places: PluginPlaces, cmd: CommandLine | null): Map<string, boolean> {
  const layers: (Record<string, unknown> | null)[] = [];
  const remote = remoteSettingsApply(places.env) ? readRemoteSettings(places.configDir) : null;
  if (remote?.deliversPolicy) layers.push(remote.settings);
  if (managedFilesApply(remote)) {
    const dir = safeManagedDir(places.env);
    if (dir !== null) layers.push(readManagedFiles(dir).merged);
  }
  const s = settingSources(cmd);
  const reads = (source: string): boolean => s.kind !== 'listed' || s.sources.has(source);
  if (reads('user')) layers.push(readObject(path.join(places.configDir, 'settings.json')));
  if (places.projectDir !== null) {
    if (reads('project')) layers.push(readObject(path.join(places.projectDir, '.claude', 'settings.json')));
    if (reads('local')) layers.push(readObject(path.join(places.projectDir, '.claude', 'settings.local.json')));
  }
  if (cmd !== null) for (const v of optionValues(cmd, '--settings').slice(-1)) layers.push(settingsArgument(v));
  const enabled = new Map<string, boolean>();
  for (const layer of layers) {
    const e = layer !== null && isObject(layer.enabledPlugins) ? layer.enabledPlugins : null;
    if (e !== null) for (const [id, on] of Object.entries(e)) if (typeof on === 'boolean') enabled.set(id, on);
  }
  return enabled;
}

/** noonsight as a plugin of one login. */
export interface NoonsightPlugin {
  readonly id: string;
  /** The folder it runs from, or null when the settings turn it on and it is not installed yet. */
  readonly dir: string | null;
  readonly scope: string | null;
  readonly enabled: boolean;
  /** The version its folder holds, or null when the folder is gone or cannot be read. */
  readonly version: string | null;
}

/** noonsight's plugin in a login's configuration directory, once per marketplace it comes from. */
export function noonsightPlugins(places: PluginPlaces): NoonsightPlugin[] {
  const enabled = enabledPlugins(places, null);
  const installed = installedPlugins(places).filter((p) => p.name === PLUGIN_NAME);
  const found: NoonsightPlugin[] = installed.map((p) => ({
    id: p.id,
    dir: p.dir,
    scope: p.scope,
    enabled: enabled.get(p.id) === true,
    version: pluginVersion(p.dir),
  }));
  for (const [id, on] of enabled)
    if (on && id.startsWith(`${PLUGIN_NAME}@`) && !installed.some((p) => p.id === id)) found.push({ id, dir: null, scope: null, enabled: true, version: null });
  return found;
}

function pluginVersion(dir: string): string | null {
  if (!fs.existsSync(path.join(dir, 'dist', 'src', 'cli.js'))) return null;
  const manifest = readObject(path.join(dir, '.claude-plugin', 'plugin.json'));
  return typeof manifest?.version === 'string' ? manifest.version : null;
}

/**
 * Whether this copy of noonsight is the one a plugin runs: Claude Code named its folder to the process
 * (a hook or a skill of the plugin), or it lies in a plugin cache. Claude Code deletes such a folder some
 * time after an update, so nothing that stays may point at it.
 */
export function runsFromPlugin(env: Env, root: string = PACKAGE_ROOT): boolean {
  if (env.CLAUDE_PLUGIN_ROOT && realpath(env.CLAUDE_PLUGIN_ROOT) === realpath(root)) return true;
  return /[\\/]plugins[\\/]cache[\\/][^\\/]+[\\/][^\\/]+[\\/][^\\/]+[\\/]?$/.test(realpath(root)) && fs.existsSync(path.join(root, '.claude-plugin', 'plugin.json'));
}

function realpath(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}
