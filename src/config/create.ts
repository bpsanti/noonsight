// The first configuration file, written from the preset: every model the preset has rules for, declared
// with "use": "preset". `noonsight init`, `noonsight install` and a plugin's first session start write it;
// none of them ever replaces a file.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFileAtomic } from '../state/files.js';
import { DEFAULT_PRESET, loadConfigDetails, readPreset } from './load.js';
import { configPath, type Env } from './paths.js';

/** Where the published configuration schema lives, for editors that validate and complete the file. */
export const CONFIG_SCHEMA_URL = 'https://unpkg.com/noonsight@0/schema/noonsight.schema.json';

/**
 * Write the configuration file from the preset and describe what was written, or return null when a
 * file already exists, which is never replaced. `noonsight install` composes this with the hooks.
 */
export function writeConfig(env: Env, home: string = os.homedir()): string[] | null {
  const file = configPath(env, home);
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
  // A file that appeared since the check above is never replaced, and a session that starts now reads all of it or none.
  if (!createFileAtomic(file, `${JSON.stringify(content, null, 2)}\n`)) return null;

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
