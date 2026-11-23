// noonsight init: write a first configuration file from the preset, declaring every model the preset
// has rules for with "use": "preset". It never replaces an existing file, and it reads only the
// installed preset.

import { writeConfig } from '../config/create.js';
import { configPath, type Env } from '../config/paths.js';
import { UsageError } from './usage.js';

export const INIT_USAGE = `usage: noonsight init

Create the configuration file from the preset: every model the preset has rules for is declared
with "use": "preset", and so receives the preset's rules that are on by default. The file goes to
$NOONSIGHT_CONFIG, else ~/.config/noonsight/noonsight.json; an existing file is never replaced.
Exits 0 when the file was written, 1 when one already exists, and 2 for a usage error or a
refused preset.`;

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
