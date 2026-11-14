#!/usr/bin/env node
// sextant command line. Exit codes: 0 for success and for every decision (matched, none,
// undeclared); 1 when install, uninstall or check finds a problem; 2 for a usage error or a refused
// configuration. `sextant hook` always exits 0.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHECK_USAGE, runCheck } from './commands/check.js';
import { HOOK_USAGE, runHookCommand } from './commands/hook.js';
import { INSTALL_USAGE, runInstall } from './commands/install.js';
import { RESOLVE_USAGE, runResolve } from './commands/resolve.js';
import { UsageError } from './commands/usage.js';
import { ConfigError } from './config/load.js';
import type { Env } from './config/paths.js';
import { packageVersion } from './version.js';

const USAGE = `usage: sextant <command>

Commands:
  install [--account <dir>|--managed]
                                    install the Claude Code hooks: by default for every Claude Code
                                    login of this account, or for one directory, or machine-wide
  uninstall [--account <dir>|--managed]
                                    remove them
  check                             check the configuration, the installs and Claude Code
  resolve <model> [scope] [place]   show the rules a model receives
  hook <event>                      the hook adapter that Claude Code runs; not run by hand

Options:
  --help       show this help
  --version    print the version

The configuration is read from $SEXTANT_CONFIG, else ~/.config/sextant/sextant.json. One file serves every Claude Code account on the machine.`;

export interface Io {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

const COMMAND_USAGE: Record<string, string> = {
  resolve: RESOLVE_USAGE,
  install: INSTALL_USAGE,
  uninstall: INSTALL_USAGE,
  check: CHECK_USAGE,
  hook: HOOK_USAGE,
};

export function main(argv: readonly string[], env: Env, io: Io): number {
  const [command, ...rest] = argv;
  // The hook never prints usage or fails: Claude Code would show it as a hook error.
  if (command === 'hook') return runHookCommand(rest, env, io.out);
  try {
    const usage = command !== undefined ? COMMAND_USAGE[command] : undefined;
    if (usage !== undefined && (rest.includes('--help') || rest.includes('-h'))) {
      io.out(usage);
      return 0;
    }
    switch (command) {
      case '--version':
      case '-v':
        io.out(packageVersion());
        return 0;
      case '--help':
      case '-h':
      case 'help':
        io.out(USAGE);
        return 0;
      case 'resolve':
        io.out(JSON.stringify(runResolve(rest, env), null, 2));
        return 0;
      case 'install':
      case 'uninstall':
        return runInstall(command, rest, env, io);
      case 'check':
        return runCheck(rest, env, io.out);
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

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2), process.env, {
    out: (t) => process.stdout.write(`${t}\n`),
    err: (t) => process.stderr.write(`${t}\n`),
  });
}
