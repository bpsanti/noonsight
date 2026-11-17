// noonsight accept: record the installed preset version as the one the configuration accepted. It
// lists what that version changes since the accepted one, checks that the configuration loads with
// it, and rewrites only the "preset_version" value of the file, keeping its formatting.

import fs from 'node:fs';
import { ConfigError, DEFAULT_PRESET, loadConfigDetails, readPreset } from '../config/load.js';
import { configPath, type Env } from '../config/paths.js';
import { comparePresets, describeChanges, type PresetComparison } from '../config/preset-changes.js';
import { setTopLevelString } from '../config/rewrite.js';
import { isPermissionError, modeOf, writeFileAtomic } from '../state/files.js';
import { UsageError } from './usage.js';

export const ACCEPT_USAGE = `usage: noonsight accept

Accept the installed preset version: list what it changes since the version the configuration
accepted ("preset_version"), then write the installed version there. Only that value of the file
changes; the rest of the file stays as it is. The configuration must load with the installed version,
so an enable or disable entry that names a rule the installed preset no longer has is removed first.
Exits 0 when the version was written or already was the installed one, 1 when the file cannot be
written, and 2 for a usage error, a refused configuration, or a preset that is not installed.`;

export interface AcceptIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

export function runAccept(args: readonly string[], env: Env, io: AcceptIo): number {
  if (args.length) throw new UsageError(`unexpected argument "${args[0]}"`, ACCEPT_USAGE);
  const file = configPath(env);
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw e;
    io.err(`noonsight: there is no configuration file at ${file}; \`noonsight install\` writes one`);
    return 2;
  }
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch (e) {
    throw new ConfigError(file, [`not valid JSON: ${(e as Error).message}`]);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new ConfigError(file, ['the file is not a JSON object']);
  const name = typeof raw.preset === 'string' ? raw.preset : DEFAULT_PRESET;
  const installed = readPreset(name, {}, env);
  const to = installed.version;
  const accepted = typeof raw.preset_version === 'string' ? raw.preset_version : null;

  let next: string;
  try {
    next = accepted === to ? text : setTopLevelString(text, 'preset_version', to, ['preset', 'version']);
  } catch (e) {
    io.err(`noonsight: ${file}: ${(e as Error).message}; set "preset_version" to "${to}" by hand`);
    return 1;
  }
  let details;
  try {
    details = loadConfigDetails(file, { content: next }, env);
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    io.err(
      `noonsight: with preset ${name} ${to}, ${e.message}\n` +
        `Nothing was written. Fix these, then run \`noonsight accept\` again; \`noonsight check\` lists what ${to} changes.`,
    );
    return 2;
  }

  // What changes, read as the configuration stood: from the version it accepted, delivered as it is now.
  let comparison: PresetComparison | null = null;
  let copyProblem: string | null = null;
  try {
    comparison = comparePresets({ ...details.presetVersions, accepted, onChange: 'warn' }, details.declared, {}, env);
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    copyProblem = e.problems.join('; ');
  }
  const lines: string[] = [];
  if (accepted === to) {
    lines.push(`${file}: preset ${name} ${to} is already the accepted version; nothing to change`);
    for (const m of comparison?.models ?? []) lines.push(`  ${m.model}: ${describeChanges(m)}`);
    io.out(lines.join('\n'));
    return 0;
  }
  lines.push(`preset ${name} ${to}, accepted until now: ${accepted ?? 'not recorded'}`);
  if (accepted === null) lines.push(`  ${file} records no version, so nothing says what changed; \`noonsight models\` lists the rules of ${to}`);
  else if (copyProblem !== null) lines.push(`  the copy of ${accepted} the package keeps was refused, so what changed cannot be listed: ${copyProblem}`);
  else if (comparison?.from === null) lines.push(`  the package keeps no copy of ${accepted}, so what changed cannot be listed; \`noonsight models\` lists the rules of ${to}`);
  else if (comparison?.models.length === 0) lines.push('  no rule a declared model receives changes');
  else for (const m of comparison?.models ?? []) lines.push(`  ${m.model}: ${describeChanges(m)}`);

  // Written through a symbolic link, so a configuration kept elsewhere (dotfiles) stays a link.
  const target = fs.realpathSync(file);
  try {
    writeFileAtomic(target, next, modeOf(target, 0o644));
  } catch (e) {
    if (!isPermissionError(e)) throw e;
    io.out(lines.join('\n'));
    io.err(`noonsight: cannot write ${target} (${(e as NodeJS.ErrnoException).code}); set "preset_version" to "${to}" by hand`);
    return 1;
  }
  lines.push(
    `wrote "preset_version": "${to}" to ${file}` +
      (details.presetVersions.onChange === 'hold' && accepted !== null ? `; sessions now receive the rules of ${to}` : ''),
  );
  io.out(lines.join('\n'));
  return 0;
}
