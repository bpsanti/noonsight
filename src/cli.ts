#!/usr/bin/env node
// sextant command line. Exit codes: 0 for every decision (matched, none, undeclared);
// 2 for a usage error or a refused configuration.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RESOLVE_USAGE, runResolve } from './commands/resolve.js';
import { UsageError } from './commands/usage.js';
import { ConfigError } from './config/load.js';
import { PACKAGE_ROOT, type Env } from './config/paths.js';

const USAGE = `usage: sextant <command>

Commands:
  resolve <model> [--scope <scope>] [--place <place>]   show the rules a model receives

Options:
  --help       show this help
  --version    print the version

The configuration is read from $SEXTANT_CONFIG, else $XDG_CONFIG_HOME/sextant/sextant.json,
else ~/.config/sextant/sextant.json. One file serves every Claude Code account on the machine.`;

export interface Io {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

export function main(argv: readonly string[], env: Env, io: Io): number {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case '--version':
      case '-v':
        io.out(version());
        return 0;
      case '--help':
      case '-h':
      case 'help':
        io.out(USAGE);
        return 0;
      case 'resolve':
        if (rest.includes('--help') || rest.includes('-h')) {
          io.out(RESOLVE_USAGE);
          return 0;
        }
        io.out(JSON.stringify(runResolve(rest, env), null, 2));
        return 0;
      case undefined:
        throw new UsageError('missing the command', USAGE);
      default:
        throw new UsageError(`unknown command "${command}"`, USAGE);
    }
  } catch (e) {
    if (e instanceof UsageError) {
      io.err(`sextant: ${e.message}\n\n${e.usage}`);
      return 2;
    }
    if (e instanceof ConfigError) {
      io.err(`sextant: ${e.message}\nNothing from this configuration was applied.`);
      return 2;
    }
    throw e;
  }
}

function version(): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string };
  return pkg.version;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2), process.env, {
    out: (t) => process.stdout.write(`${t}\n`),
    err: (t) => process.stderr.write(`${t}\n`),
  });
}
