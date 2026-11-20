// Project configuration: a file a repository commits at .noonsight/noonsight.json, laid over the
// machine's configuration for the sessions that run in that project. The machine's configuration
// decides how far a project may change it ("projects.allow"), and a project applies only once this
// account trusts its directory (`noonsight trust`). This module finds the file, keeps the trust
// records, and merges the two files; load.ts checks the result as it checks any configuration.

import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '../core/types.js';
import { writeFileAtomic } from '../state/files.js';
import type { ProjectLayer, RawConfig, RawModelEntry, RawModelRule, RawUserRule } from './load.js';

/** Where a project keeps its configuration, relative to the project directory. */
export const PROJECT_FILE = path.join('.noonsight', 'noonsight.json');

/**
 * How far a project may change the machine's configuration, from least to most.
 *   none   project files are ignored.
 *   add    a project only adds rules, for models the machine declares with "preset" or "custom".
 *   rules  a project also changes which rules a model receives, and declares scopes.
 *   all    a project also sets routing, the classifier and the subagent settings.
 */
export const PROJECT_ALLOW = ['none', 'add', 'rules', 'all'] as const;
export type ProjectAllow = (typeof PROJECT_ALLOW)[number];

/** Projects may add rules, and nothing else, unless the machine's configuration says otherwise. */
export const DEFAULT_PROJECT_ALLOW: ProjectAllow = 'add';

/** The top-level keys a project file may write at each level; "version" and "$schema" always. */
const KEYS: Readonly<Record<Exclude<ProjectAllow, 'none'>, readonly string[]>> = {
  add: ['all_models', 'models'],
  rules: ['all_models', 'models', 'scopes', 'session', 'on_undeclared'],
  all: ['all_models', 'models', 'scopes', 'session', 'on_undeclared', 'routing', 'classifier', 'subagents'],
};

/** The lowest level that allows a top-level key of a project file. */
function levelFor(key: string): Exclude<ProjectAllow, 'none'> {
  return KEYS.add.includes(key) ? 'add' : KEYS.rules.includes(key) ? 'rules' : 'all';
}

/** A project's configuration file and the directory it serves. */
export interface ProjectFile {
  /** The project directory: the one that holds `.noonsight/`. */
  readonly dir: string;
  readonly file: string;
}

/** A project file found for a session, with whether this account trusts it. */
export interface ProjectInput extends ProjectFile {
  /** true: trusted; false: declined with `noonsight untrust`; null: never decided. */
  readonly trusted: boolean | null;
}

/**
 * The directory holding `.git` (a directory, or a file in a worktree) above `start`, or `start`
 * itself when there is none.
 */
export function repositoryRoot(start: string): string {
  for (let d = start; ; d = path.dirname(d)) {
    if (exists(path.join(d, '.git'))) return d;
    if (path.dirname(d) === d) return start;
  }
}

/**
 * The nearest project file from a directory up to its repository root, the closest first; outside
 * a repository, only the directory itself is looked at.
 */
export function findProject(start: string | null): ProjectFile | null {
  if (start === null || start === '') return null;
  const from = path.resolve(start);
  const top = repositoryRoot(from);
  for (let d = from; ; d = path.dirname(d)) {
    const file = path.join(d, PROJECT_FILE);
    if (isFile(file)) return { dir: d, file };
    if (d === top || path.dirname(d) === d) return null;
  }
}

/**
 * The project file for a session or a command started in `start`, with this account's trust in it;
 * null when there is none, or when it is the machine's configuration file itself.
 */
export function projectFor(start: string | null, machineFile: string, stateDir: string): ProjectInput | null {
  const found = findProject(start);
  if (found === null || real(found.file) === real(machineFile)) return null;
  return { ...found, trusted: trustOf(stateDir, found.dir) };
}

// Trust. One record per project directory, by its real path, in the account's state directory:
// hooks run as the account that owns the session, so each account decides for itself.

const TRUST_FILE = 'projects.json';

interface TrustRecord {
  readonly dir: string;
  readonly trusted: boolean;
  readonly at: string;
}

function trustFile(stateDir: string): string {
  return path.join(stateDir, TRUST_FILE);
}

function readTrust(stateDir: string): TrustRecord[] {
  try {
    const value = JSON.parse(fs.readFileSync(trustFile(stateDir), 'utf8')) as { projects?: unknown };
    if (!Array.isArray(value.projects)) return [];
    return value.projects.filter(
      (r): r is TrustRecord => typeof r === 'object' && r !== null && typeof r.dir === 'string' && typeof r.trusted === 'boolean',
    );
  } catch {
    // Missing or unreadable: no project is trusted.
    return [];
  }
}

/** Whether this account trusts a project directory: true, false when it declined, null when it never decided. */
export function trustOf(stateDir: string, dir: string): boolean | null {
  const key = real(dir);
  return readTrust(stateDir).find((r) => r.dir === key)?.trusted ?? null;
}

/** Record this account's decision for a project directory; returns the decision it had before. */
export function setTrust(stateDir: string, dir: string, trusted: boolean, now: Date): boolean | null {
  const key = real(dir);
  const records = readTrust(stateDir);
  const before = records.find((r) => r.dir === key)?.trusted ?? null;
  const next = [...records.filter((r) => r.dir !== key), { dir: key, trusted, at: now.toISOString() }].sort((a, b) =>
    a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0,
  );
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  writeFileAtomic(trustFile(stateDir), `${JSON.stringify({ projects: next }, null, 2)}\n`, 0o600);
  return before;
}

// The merge.

/** A project file's shape after its schema: the machine's keys a project may write, with "use" optional. */
export type RawProject = Omit<RawConfig, 'preset' | 'preset_version' | 'on_preset_change' | 'projects' | 'models'> & {
  models?: Record<string, Partial<RawModelEntry>>;
};

/** Where a rule of the merged configuration came from, when it is the project's. */
export interface RuleOrigin {
  /** Its location in the project file. */
  readonly at: string;
  /** Its file as the project writes it. */
  readonly file: string;
}

export interface ProjectMerge {
  /** The merged configuration, in the machine file's shape; project rule files are absolute paths. */
  readonly raw: RawConfig;
  /** Keys the machine's "projects.allow" does not let the project write. */
  readonly problems: readonly string[];
  /** Project entries that do not apply on this machine, and why. */
  readonly notes: readonly string[];
  /** The project's rules in the merged configuration. */
  readonly origins: WeakMap<RawUserRule, RuleOrigin>;
}

/** Whether `file`, once symlinks are followed, is inside `dir`; a file that cannot be resolved is judged by its path. */
function insideProject(dir: string, file: string): boolean {
  let rel: string;
  try {
    rel = path.relative(fs.realpathSync(dir), fs.realpathSync(file));
  } catch {
    rel = path.relative(dir, file);
  }
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

/**
 * Lay a project file over the machine's configuration; the project's rule files are resolved
 * against `baseDir`, the project file's directory, and must stay inside `projectDir`. Every value the project writes replaces the
 * machine's, key by key, with these exceptions:
 *   - rule lists ("all_models.add", "models.<id>.add") add up, the machine's rules first; above
 *     "add", a project rule with the id of a machine rule in the same list replaces it in its place,
 *     taking its "replaces" unless it gives its own, and a project rule that replaces the preset rule
 *     a machine rule replaces takes that machine rule's place;
 *   - a model entry with the machine's "use", or none, is merged into the machine's entry: "enable"
 *     and "disable" by rule id, the project's choice winning, and "add" as above; an entry with
 *     another "use" replaces the machine's entry;
 *   - a scope keeps its place and takes only the keys the project gives;
 *   - routing rows replace the machine's row of the same scope.
 * An entry without "use" for a model the machine does not declare with "preset" or "custom" leaves
 * the model as the machine declares it, and is reported as a note.
 */
export function mergeProject(
  machine: RawConfig,
  project: RawProject,
  allow: Exclude<ProjectAllow, 'none'>,
  baseDir: string,
  projectDir: string,
  presetId: (model: string, id: string) => string,
): ProjectMerge {
  const problems: string[] = [];
  const notes: string[] = [];
  const origins = new WeakMap<RawUserRule, RuleOrigin>();
  const refuse = (at: string, what: string, level: ProjectAllow): void => {
    problems.push(`${at}: ${what} needs "projects": { "allow": "${level}" } in the machine's configuration, which allows "${allow}"`);
  };

  for (const key of Object.keys(project))
    if (key !== 'version' && key !== '$schema' && !KEYS[allow].includes(key)) refuse(`/${key}`, `"${key}"`, levelFor(key));
  if (allow === 'add')
    for (const [model, entry] of Object.entries(project.models ?? {})) {
      for (const key of Object.keys(entry)) if (key !== 'add') refuse(`/models/${model}/${key}`, `"${key}" for a model`, 'rules');
      (entry.add ?? []).forEach((u, i) => {
        if (u.replaces !== undefined) refuse(`/models/${model}/add/${i}/replaces`, '"replaces" for a rule', 'rules');
      });
    }
  if (problems.length) return { raw: machine, problems, notes, origins };

  const replace = allow !== 'add';
  const rules = <R extends RawModelRule>(
    base: readonly R[] | undefined,
    added: readonly R[] | undefined,
    at: string,
    current: (id: string) => string = (id) => id,
  ): R[] => {
    const out = [...(base ?? [])];
    (added ?? []).forEach((u, i) => {
      const rule: R = { ...u, file: path.resolve(baseDir, u.file) };
      if (path.isAbsolute(u.file))
        problems.push(`${at}/${i}/file: "${u.file}" is an absolute path; a project rule file must be relative to the project file`);
      else if (!insideProject(projectDir, rule.file))
        problems.push(`${at}/${i}/file: "${u.file}" is outside the project directory ${projectDir}; a project rule file must stay inside it`);
      origins.set(rule, { at: `${at}/${i}`, file: u.file });
      // Only one of the machine's rules is replaced; a project rule that repeats an id is left for the
      // loader to report, as a repeated id always is. A project rule that takes the place of a machine
      // rule keeps the preset rule that machine rule replaces off, unless it names its own.
      const same = replace ? out.findIndex((r) => r.id === u.id && !origins.has(r)) : -1;
      if (same >= 0 && rule.replaces === undefined && out[same]?.replaces !== undefined) rule.replaces = out[same].replaces;
      // A project rule that replaces the preset rule a machine rule replaces takes that machine rule's place.
      const replaced = rule.replaces === undefined ? undefined : current(rule.replaces);
      const rival =
        replace && replaced !== undefined
          ? out.findIndex((r, j) => j !== same && r.replaces !== undefined && current(r.replaces) === replaced && !origins.has(r))
          : -1;
      if (same >= 0) out[same] = rule;
      else if (rival >= 0) out[rival] = rule;
      else out.push(rule);
      if (same >= 0 && rival >= 0) out.splice(rival, 1);
    });
    return out;
  };

  const raw: RawConfig = { ...machine };
  if (project.all_models) raw.all_models = { add: rules(machine.all_models?.add, project.all_models.add, '/all_models/add') };

  if (project.models) {
    const models: Record<string, RawModelEntry> = { ...(machine.models ?? {}) };
    for (const [key, entry] of Object.entries(project.models)) {
      const at = `/models/${key}`;
      const mine = machine.models?.[key];
      const current = (id: string): string => presetId(key, id);
      if (entry.use === undefined) {
        if (mine === undefined || mine.use === 'none') {
          notes.push(
            `${at}: the machine's configuration ${mine === undefined ? `does not declare ${key} with its exact key` : `declares ${key} with "use": "none"`}, ` +
              `so the project's entry for it does not apply here; ${allow === 'add' ? 'declaring the model is for the machine' : 'give the entry a "use" to declare it for this project'}`,
          );
          continue;
        }
        models[key] = mergeEntry(mine, entry, mine.use, (list) => rules(mine.add, list, `${at}/add`, current), current);
      } else if (mine === undefined || mine.use !== entry.use) {
        models[key] = { ...entry, use: entry.use, ...(entry.add ? { add: rules([], entry.add, `${at}/add`) } : {}) } as RawModelEntry;
      } else models[key] = mergeEntry(mine, entry, entry.use, (list) => rules(mine.add, list, `${at}/add`, current), current);
    }
    raw.models = models;
  }

  if (project.scopes) {
    const scopes = { ...(machine.scopes ?? {}) };
    for (const [name, scope] of Object.entries(project.scopes)) scopes[name] = { ...(scopes[name] ?? {}), ...scope };
    raw.scopes = scopes;
  }
  if (project.on_undeclared !== undefined) raw.on_undeclared = project.on_undeclared;
  if (project.session) raw.session = { ...machine.session, ...project.session };
  if (project.subagents) raw.subagents = { ...machine.subagents, ...project.subagents };
  if (project.classifier) raw.classifier = { ...machine.classifier, ...project.classifier };
  if (project.routing) {
    const { table, ...rest } = project.routing;
    raw.routing = { ...machine.routing, ...rest, ...(table || machine.routing?.table ? { table: { ...machine.routing?.table, ...table } } : {}) };
  }
  return { raw, problems, notes, origins };
}

/**
 * A project entry merged into the machine's entry of the same "use", the project's choice winning
 * where it meets one of the machine's "replaces": a project "enable" of a preset rule the machine
 * replaced brings the rule back, and the machine's rule that replaced it stays as a rule of "add";
 * a project "disable" of such a rule changes nothing; a project "replaces" drops the machine's
 * "enable" or "disable" of the rule.
 */
function mergeEntry(
  mine: RawModelEntry,
  theirs: Partial<RawModelEntry>,
  use: RawModelEntry['use'],
  addRules: (list: readonly RawModelRule[] | undefined) => RawModelRule[],
  current: (id: string) => string,
): RawModelEntry {
  const replacedBy = (list: readonly RawModelRule[] | undefined): Set<string> =>
    new Set((list ?? []).flatMap((r) => (r.replaces === undefined ? [] : [current(r.replaces)])));
  const projectReplaces = replacedBy(theirs.add);
  const add = addRules(theirs.add);
  const machineReplaces = new Set([...replacedBy(add)].filter((id) => !projectReplaces.has(id)));
  const on = new Set((theirs.enable ?? []).map(current));
  const off = new Set((theirs.disable ?? []).filter((id) => !machineReplaces.has(current(id))));
  const offCurrent = new Set([...off].map(current));
  const enable = unique([...(mine.enable ?? []).filter((id) => !offCurrent.has(current(id)) && !projectReplaces.has(current(id))), ...(theirs.enable ?? [])]);
  const disable = unique([...(mine.disable ?? []).filter((id) => !on.has(current(id)) && !projectReplaces.has(current(id))), ...off]);
  add.forEach((r, i) => {
    if (r.replaces === undefined || !on.has(current(r.replaces)) || projectReplaces.has(current(r.replaces))) return;
    if (mine.add?.includes(r)) {
      const { replaces: _replaces, ...rest } = r;
      add[i] = rest;
    } else delete r.replaces;
  });
  return { use, ...(enable.length ? { enable } : {}), ...(disable.length ? { disable } : {}), ...(add.length || mine.add ? { add } : {}) };
}

/** The top-level keys a project file writes, and the models whose declaration it changes, as commands describe it. */
export function projectKeys(project: RawProject): readonly string[] {
  const keys = Object.keys(project).filter((k) => k !== 'version' && k !== '$schema' && k !== 'all_models' && k !== 'models');
  const changed = Object.entries(project.models ?? {}).filter(([, e]) => Object.keys(e).some((k) => k !== 'add'));
  return [...keys, ...changed.map(([model]) => `models.${model}`)];
}

/**
 * The project's rules a merged configuration gives at least one model, as commands describe them:
 * those of "all_models" once each, then each model's own. A rule the project writes for a model the
 * machine leaves out, or for a model that receives no rules, is not one of them.
 */
export function projectRules(config: Config): string[] {
  const shared = new Set<string>();
  const own: string[] = [];
  for (const [model, entry] of config.exact) {
    if (entry.use !== 'rules') continue;
    for (const rule of entry.rules) {
      if (!rule.project) continue;
      if (rule.allModels) shared.add(`${rule.id} (all_models)`);
      else own.push(`${rule.id} (${model})`);
    }
  }
  return [...shared, ...own];
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function real(file: string): string {
  try {
    return fs.realpathSync(file);
  } catch {
    return path.resolve(file);
  }
}

function exists(file: string): boolean {
  try {
    fs.statSync(file);
    return true;
  } catch {
    return false;
  }
}

function isFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * The warning for a project left out that the person can act on: one never trusted, or refused.
 * A project declined with `noonsight untrust`, or ignored by "projects.allow", warns of nothing.
 */
export function projectWarning(layer: ProjectLayer | null): string | null {
  if (layer === null) return null;
  if (layer.status === 'untrusted')
    return (
      `noonsight: this project has its own noonsight configuration (${layer.file}), which this account has not trusted, ` +
      `so only the machine's configuration applies here. Review it, then run \`noonsight trust\` in ${layer.dir} to apply it, ` +
      'or `noonsight untrust` there to stop this warning.'
    );
  if (layer.status === 'refused')
    return (
      `noonsight: the project's configuration at ${layer.file} was refused (${layer.problems.length} ${layer.problems.length === 1 ? 'problem' : 'problems'}), ` +
      `so only the machine's configuration applies here. Run \`noonsight check\` in ${layer.dir} to see the problems.`
    );
  return null;
}

/** The decision log's fields for a project: its directory and what became of it. */
export function projectFields(layer: ProjectLayer | null): Record<string, unknown> {
  return layer === null ? {} : { project: layer.dir, project_status: layer.status };
}

/** What became of a project, in one line, as `noonsight check`, `models`, `trust` and `report` print it. */
export function describeProject(layer: ProjectLayer): string {
  const only = `so sessions in ${layer.dir} get only the machine's configuration`;
  switch (layer.status) {
    case 'applied': {
      const keys = layer.raw ? projectKeys(layer.raw) : [];
      return (
        `applied over the machine's configuration ("projects.allow": "${layer.allow}"), trusted for this account` +
        (layer.rules.length ? `; rules: ${layer.rules.join(', ')}` : '') +
        (keys.length ? `; sets ${keys.join(', ')}` : '')
      );
    }
    case 'untrusted':
      return `not trusted for this account, ${only}; review it, then run \`noonsight trust\` there`;
    case 'declined':
      return `declined for this account (\`noonsight untrust\`), ${only}; \`noonsight trust\` there applies it`;
    case 'ignored':
      return `ignored, since the machine's configuration sets "projects.allow" to "none"`;
    case 'refused':
      return `refused, ${only}: ${layer.problems.join('; ')}`;
  }
}
