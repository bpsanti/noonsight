// Subagent definitions, read where Claude Code reads them
// (https://code.claude.com/docs/en/sub-agents, "Choose the subagent scope"). When several places
// define one name, the highest-ranked wins:
//
//   1. managed: .claude/agents/ in the managed settings directory;
//   2. the --agents option of the claude command, inline JSON or, in claude -p, a JSON file;
//   3. project: every .claude/agents/ from the project directory up to the repository root, the
//      closest first, then .claude/agents/ in each directory given with --add-dir;
//   4. user: agents/ in the Claude Code configuration directory;
//   5. a plugin's agents, whose names carry the plugin's name: plugin:agent.
//
// Managed, project and user folders are scanned recursively, and a subagent there is known by the name
// in its frontmatter. --setting-sources leaves out the project and user folders it does not list. A
// plugin's agents are the files its manifest lists under "agents", else every Markdown file under its
// agents/ folder, where each subfolder adds a part to the name; the last part is the frontmatter's
// name, else the file's name. Claude Code 2.1.330 orders the places so, as its bundled code reads and a
// stub session confirmed.
//
// The plugins read are those given with --plugin-dir or --plugin-dir-no-mcp, those in
// CLAUDE_CODE_PLUGIN_DIRS, and those installed from a marketplace (plugins/installed_plugins.json in the
// configuration directory) that the settings enable for the project. Plugins Claude Code gets any
// other way, such as ones an organization syncs to its members, are not read.

import fs from 'node:fs';
import path from 'node:path';
import type { Env } from '../../config/paths.js';
import { repositoryRoot } from '../../config/project.js';
import { NO_BOUNDARIES, optionValues, readObject, safeManagedDir, settingSources, type CommandLine } from './launch.js';
import { enabledPlugins, installedPlugins } from './plugins.js';
import { isObject } from './settings.js';

/** Where a definition was found, as the decision log records it. */
export type DefinitionSource = 'managed' | 'flag' | 'project' | 'user' | 'plugin';

/** A subagent definition: the place that defines the subagent, and the model and effort it sets. */
export interface Definition {
  /** The definition's file, or "--agents" for one given inline on the command line. */
  readonly file: string;
  readonly source: DefinitionSource;
  readonly model: string | null;
  readonly effort: string | null;
}

/**
 * What a lookup found: a definition; none, so the name is a built-in subagent or unknown; or a place
 * that may define it and that noonsight cannot read, so the definition that decides is not known.
 */
export type Lookup =
  | { readonly kind: 'found'; readonly definition: Definition }
  | { readonly kind: 'none' }
  | { readonly kind: 'unread'; readonly why: string };

export interface DefinitionPlaces {
  /** The session's project directory, where the walk up starts. */
  readonly projectDir: string | null;
  /** The Claude Code configuration directory of the account. */
  readonly configDir: string;
  readonly env: Env;
  /** The Claude Code command line, read only when a lookup needs it; null when it cannot be read. */
  readonly commandLine: () => CommandLine | null;
}

const MAX_DEPTH = 6;
const MAX_FILES = 2000;
const HEAD_BYTES = 8192;

/** A lookup by subagent name, reading each place once, and only as far as the name needs. */
export function definitionFinder(places: DefinitionPlaces): (name: string) => Lookup {
  const cmd = once(places.commandLine);
  const flag = once(() => flagAgents(cmd(), places.projectDir));
  const sources = once(() => settingSources(cmd()));
  const plugins = once(() => pluginRoots(places, cmd()));
  const seen = new Map<string, Lookup>();
  const find = (name: string): Lookup => {
    const managed = managedAgentsDir(places.env);
    if (managed !== null) {
      const found = findIn(managed, name, 'managed');
      if (found !== null) return { kind: 'found', definition: found };
    }
    const f = flag();
    if (f.kind === 'unread') return f;
    const fromFlag = f.kind === 'found' ? f.definitions.get(name) : undefined;
    if (fromFlag !== undefined) return { kind: 'found', definition: fromFlag };
    const s = sources();
    const reads = (source: string): boolean => s.kind !== 'listed' || s.sources.has(source);
    if (reads('project'))
      for (const dir of projectDirs(places.projectDir, cmd())) {
        const found = findIn(dir, name, 'project');
        if (found !== null) return { kind: 'found', definition: found };
      }
    if (reads('user')) {
      const found = findIn(path.join(places.configDir, 'agents'), name, 'user');
      if (found !== null) return { kind: 'found', definition: found };
    }
    if (name.includes(':')) return pluginDefinition(plugins(), name);
    return { kind: 'none' };
  };
  return (name) => {
    if (!seen.has(name)) seen.set(name, find(name));
    return seen.get(name) as Lookup;
  };
}

/** .claude/agents/ in the managed settings directory. */
function managedAgentsDir(env: Env): string | null {
  const dir = safeManagedDir(env);
  return dir === null ? null : path.join(dir, '.claude', 'agents');
}

/** Every project folder of definitions, the highest-ranked first. */
function projectDirs(projectDir: string | null, cmd: CommandLine | null): string[] {
  const dirs: string[] = [];
  if (projectDir !== null) {
    const start = path.resolve(projectDir);
    const top = repositoryRoot(start);
    for (let d = start; ; d = path.dirname(d)) {
      dirs.push(path.join(d, '.claude', 'agents'));
      if (d === top) break;
    }
  }
  for (const d of addDirs(cmd, projectDir)) dirs.push(path.join(d, '.claude', 'agents'));
  return [...new Set(dirs)];
}

/** The directories given with --add-dir, which takes one or more directories each time it is given. */
function addDirs(cmd: CommandLine | null, cwd: string | null): string[] {
  if (cmd === null) return [];
  const dirs: string[] = [];
  for (let i = 0; i < cmd.args.length; i++) {
    const a = cmd.args[i] ?? '';
    if (a === '--' && cmd.exact) break;
    if (a.startsWith('--add-dir=')) dirs.push(a.slice('--add-dir='.length));
    else if (a === '--add-dir')
      for (let j = i + 1; j < cmd.args.length && !(cmd.args[j] ?? '-').startsWith('-'); j++) dirs.push(cmd.args[j] ?? '');
  }
  return dirs.filter((d) => d !== '').map((d) => path.resolve(cwd ?? '/', d));
}

// ---------------------------------------------------------------------------------------------
// --agents: a JSON object whose keys name the subagents, each with its definition's fields. In
// claude -p it may instead be the path of a file holding the same object.

type FlagAgents = { readonly kind: 'none' } | { readonly kind: 'found'; readonly definitions: ReadonlyMap<string, Definition> } | { readonly kind: 'unread'; readonly why: string };

function flagAgents(cmd: CommandLine | null, cwd: string | null): FlagAgents {
  if (cmd === null) return { kind: 'none' };
  const values = cmd.exact ? optionValues(cmd, '--agents').slice(-1) : [...new Set(looseOption(cmd, '--agents'))];
  if (values.length === 0) return { kind: 'none' };
  if (values.length > 1) return { kind: 'unread', why: `the --agents value cannot be read: ${NO_BOUNDARIES}` };
  const value = values[0] ?? '';
  const inline = value.trimStart().startsWith('{');
  let parsed: unknown = null;
  if (inline)
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      parsed = null;
    }
  else parsed = readObject(path.resolve(cwd ?? '/', value));
  if (!isObject(parsed)) return { kind: 'unread', why: inline ? 'the --agents value is not a JSON object' : `the --agents file ${value} cannot be read` };
  const definitions = new Map<string, Definition>();
  for (const [name, d] of Object.entries(parsed))
    if (isObject(d))
      definitions.set(name, {
        file: inline ? '--agents' : path.resolve(cwd ?? '/', value),
        source: 'flag',
        model: typeof d.model === 'string' && d.model.trim() !== '' ? d.model.trim() : null,
        effort: typeof d.effort === 'string' && d.effort.trim() !== '' ? d.effort.trim() : null,
      });
  return { kind: 'found', definitions };
}

/**
 * The values an option may have had on a command line read without argument boundaries, as `ps` prints
 * it on macOS: the arguments joined by spaces, with control characters such as a newline written as a
 * backslash and three octal digits. A value that opens a JSON object runs to the brace that closes it;
 * any other value runs to the next space.
 */
function looseOption(cmd: CommandLine, name: string): string[] {
  const text = cmd.args.join(' ').replace(/\\0([0-7]{2})/g, (_, o: string) => String.fromCharCode(parseInt(o, 8)));
  const values: string[] = [];
  const at = new RegExp(`(?:^|\\s)${name}(?:=|\\s+)`, 'g');
  for (let m = at.exec(text); m !== null; m = at.exec(text)) {
    const rest = text.slice(m.index + m[0].length);
    if (rest.startsWith('{')) {
      const end = objectEnd(rest);
      values.push(end === null ? rest : rest.slice(0, end));
    } else {
      const token = /^\S+/.exec(rest)?.[0];
      if (token !== undefined) values.push(token);
    }
  }
  return values;
}

/** The index just past the brace that closes the JSON object `text` starts with, or null. */
function objectEnd(text: string): number | null {
  let depth = 0;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '\\') i++;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i + 1;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Plugins.

interface PluginRoot {
  readonly name: string;
  readonly dir: string;
}

function pluginRoots(places: DefinitionPlaces, cmd: CommandLine | null): PluginRoot[] {
  const cwd = places.projectDir;
  const inline = [
    ...(cmd === null ? [] : [...optionValues(cmd, '--plugin-dir'), ...optionValues(cmd, '--plugin-dir-no-mcp')]),
    ...(places.env.CLAUDE_CODE_PLUGIN_DIRS ?? '').split(path.delimiter).map((d) => d.trim()),
  ]
    .filter((d) => d !== '')
    .map((d) => path.resolve(cwd ?? '/', d));
  const roots: PluginRoot[] = inline.map((dir) => ({ dir, name: manifestOf(dir)?.name ?? path.basename(dir) }));
  const enabled = enabledPlugins(places, cmd);
  return [...roots, ...installedPlugins(places).filter((p) => enabled.get(p.id) === true).map((p) => ({ name: p.name, dir: p.dir }))];
}

interface Manifest {
  readonly name?: string;
  /** The agent files the manifest lists, which replace the agents/ folder; absent when it lists none. */
  readonly agents?: readonly string[];
}

function manifestOf(dir: string): Manifest | null {
  const m = readObject(path.join(dir, '.claude-plugin', 'plugin.json'));
  if (m === null) return null;
  const agents = typeof m.agents === 'string' ? [m.agents] : Array.isArray(m.agents) ? m.agents.filter((a): a is string => typeof a === 'string') : undefined;
  return { ...(typeof m.name === 'string' && m.name !== '' ? { name: m.name } : {}), ...(agents !== undefined ? { agents } : {}) };
}

/**
 * The definition of plugin:...:agent among the plugins read. Two plugins of that name that define it
 * differently leave it unread, since which one Claude Code loads is not known; a name none of them
 * defines may come from a plugin noonsight does not read.
 */
function pluginDefinition(roots: readonly PluginRoot[], name: string): Lookup {
  const plugin = name.slice(0, name.indexOf(':'));
  const found: Definition[] = [];
  for (const root of roots) {
    if (root.name !== plugin) continue;
    const d = pluginAgent(root, name);
    if (d !== null) found.push(d);
  }
  const first = found[0];
  if (first === undefined) return { kind: 'unread', why: `no plugin noonsight reads defines ${name}` };
  if (found.some((d) => d.model !== first.model || d.effort !== first.effort))
    return { kind: 'unread', why: `more than one plugin named ${plugin} defines ${name}, with different models or efforts` };
  return { kind: 'found', definition: first };
}

function pluginAgent(root: PluginRoot, name: string): Definition | null {
  const manifest = manifestOf(root.dir);
  if (manifest?.agents !== undefined) {
    for (const file of manifest.agents) {
      const full = path.resolve(root.dir, file);
      const d = agentFile(full, [root.name], name, 'plugin');
      if (d !== null) return d;
    }
    return null;
  }
  let seen = 0;
  const walk = (dir: string, parts: readonly string[], depth: number): Definition | null => {
    for (const e of entries(dir)) {
      if (++seen > MAX_FILES) return null;
      const file = path.join(dir, e.name);
      if (e.isFile() && e.name.endsWith('.md')) {
        const d = agentFile(file, parts, name, 'plugin');
        if (d !== null) return d;
      } else if (e.isDirectory() && !e.name.startsWith('.') && depth < MAX_DEPTH) {
        const d = walk(file, [...parts, e.name], depth + 1);
        if (d !== null) return d;
      }
    }
    return null;
  };
  return walk(path.join(root.dir, 'agents'), [root.name], 0);
}

/** The definition in a plugin's agent file, when its full name, the prefix and its own name, is `name`. */
function agentFile(file: string, prefix: readonly string[], name: string, source: DefinitionSource): Definition | null {
  const fm = frontmatter(readHead(file));
  const own = fm?.name ?? path.basename(file).replace(/\.md$/, '');
  if ([...prefix, own].join(':') !== name) return null;
  return { file, source, model: fm?.model ?? null, effort: fm?.effort ?? null };
}

// ---------------------------------------------------------------------------------------------
// Folders of Markdown definitions, known by the name in their frontmatter.

function findIn(root: string, name: string, source: DefinitionSource): Definition | null {
  let seen = 0;
  const walk = (dir: string, depth: number): Definition | null => {
    for (const e of entries(dir)) {
      if (++seen > MAX_FILES) return null;
      const file = path.join(dir, e.name);
      if (e.isFile() && e.name.endsWith('.md')) {
        const fm = frontmatter(readHead(file));
        if (fm !== null && fm.name === name) return { file, source, model: fm.model ?? null, effort: fm.effort ?? null };
      } else if (e.isDirectory() && depth < MAX_DEPTH) {
        const found = walk(file, depth + 1);
        if (found !== null) return found;
      }
    }
    return null;
  };
  return walk(root, 0);
}

function entries(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  } catch {
    return [];
  }
}

/** The top-level name, model and effort of a definition's YAML frontmatter, or null when it has none. */
export function frontmatter(text: string): { name?: string; model?: string; effort?: string } | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!m) return null;
  const fields: { name?: string; model?: string; effort?: string } = {};
  for (const line of (m[1] ?? '').split(/\r?\n/)) {
    const f = /^(name|model|effort):[ \t]*(.*?)[ \t]*(?:#.*)?$/.exec(line);
    if (!f) continue;
    const value = (f[2] ?? '').replace(/^(['"])(.*)\1$/, '$2').trim();
    if (value) fields[f[1] as 'name' | 'model' | 'effort'] = value;
  }
  return fields;
}

function readHead(file: string): string {
  try {
    const fd = fs.openSync(file, 'r');
    try {
      const buffer = Buffer.alloc(HEAD_BYTES);
      const n = fs.readSync(fd, buffer, 0, HEAD_BYTES, 0);
      return buffer.toString('utf8', 0, n);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
  }
}

function once<T>(f: () => T): () => T {
  let done = false;
  let value: T;
  return () => {
    if (!done) {
      value = f();
      done = true;
    }
    return value;
  };
}
