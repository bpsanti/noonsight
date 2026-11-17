// noonsight init: write a first configuration file from the preset, declaring every model the preset
// has rules for with "use": "preset". It never replaces an existing file, and it reads only the
// installed preset.

import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_PRESET, loadConfigDetails, readPreset } from '../config/load.js';
import { configPath, type Env } from '../config/paths.js';
import { UsageError } from './usage.js';

export const INIT_USAGE = `usage: noonsight init

Create the configuration file from the preset: every model the preset has rules for is declared
with "use": "preset", and so receives the preset's rules that are on by default. The file goes to
$NOONSIGHT_CONFIG, else ~/.config/noonsight/noonsight.json; an existing file is never replaced.
Exits 0 when the file was written, 1 when one already exists, and 2 for a usage error or a
refused preset.`;

/** Where the published configuration schema lives, for editors that validate and complete the file. */
export const CONFIG_SCHEMA_URL = 'https://unpkg.com/noonsight@0/schema/noonsight.schema.json';

export interface InitIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

export function runInit(args: readonly string[], env: Env, io: InitIo): number {
  if (args.length) throw new UsageError(`unexpected argument "${args[0]}"`, INIT_USAGE);
  const file = configPath(env);
  const written = writeConfig(env);
  if (written === null) {
    io.err(`noonsight: ${file} already exists, and init never replaces it; edit it, or move it away and run \`noonsight init\` again`);
    return 1;
  }
  io.out(
    [
      ...written,
      'Next: `noonsight models` lists every rule with its source, effect and cost; `noonsight install` adds the hooks; `noonsight check` checks it all.',
    ].join('\n'),
  );
  return 0;
}

/**
 * Write the configuration file from the preset and describe what was written, or return null when a
 * file already exists, which is never replaced. `noonsight install` composes this with the hooks.
 */
export function writeConfig(env: Env): string[] | null {
  const file = configPath(env);
  if (exists(file)) return null;

  const preset = readPreset(DEFAULT_PRESET, {}, env);
  const content = {
    $schema: CONFIG_SCHEMA_URL,
    version: 1,
    preset: preset.name,
    preset_version: preset.version,
    models: Object.fromEntries([...preset.models.keys()].map((key) => [key, { use: 'preset' }])),
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    // "wx" fails when the file appeared since the check above, so a file is never replaced.
    fs.writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`, { flag: 'wx' });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') return null;
    throw e;
  }

  const { preset: loaded } = loadConfigDetails(file, {}, env);
  const lines = [`wrote ${file}: preset ${preset.name} ${preset.version}, ${preset.models.size} models declared with "use": "preset"`];
  for (const [key, rules] of loaded?.models ?? []) {
    const on = rules.filter((r) => r.enabled).length;
    lines.push(`  ${key}: ${on} of ${rules.length} rules on`);
  }
  return lines;
}

function exists(file: string): boolean {
  try {
    fs.lstatSync(file);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw e;
  }
}
