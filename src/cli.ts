#!/usr/bin/env node
// noonsight command line. Exit codes: 0 for success and for every decision (matched, none,
// undeclared); 1 when install, uninstall, watch or check finds a problem; 2 for a usage error or a
// refused configuration. `noonsight init` exits 1 when the configuration file already exists.
// `noonsight hook` always exits 0, `noonsight watch run` keeps running, and `noonsight run` exits with
// claude's exit status.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHECK_USAGE, runCheck } from './commands/check.js';
import { HOOK_USAGE, runHookCommand } from './commands/hook.js';
import { INIT_USAGE, runInit } from './commands/init.js';
import { INSTALL_USAGE, runInstall } from './commands/install.js';
import { MODELS_USAGE, runModels } from './commands/models.js';
import { REPORT_USAGE, runReport } from './commands/report.js';
import { RESOLVE_USAGE, runResolve } from './commands/resolve.js';
import { runRun } from './commands/run.js';
import { UsageError } from './commands/usage.js';
import { runWatch, WATCH_USAGE } from './commands/watch.js';
import { ConfigError } from './config/load.js';
import type { Env } from './config/paths.js';
import { packageVersion } from './version.js';

const USAGE = `usage: noonsight <command>

Commands:
  init                              create the configuration file from the preset (install does it too)
  install [--account <dir>|--managed] [--hooks-only]
                                    set noonsight up: write the configuration if there is none,
                                    install the Claude Code hooks (by default for every login of this
                                    account, or one directory, or machine-wide), then check
  uninstall [--account <dir>|--managed]
                                    remove them
  watch enable|disable              turn on or off the watcher that installs the hooks into each
                                    new Claude Code login as it appears; off unless turned on
  check                             check the configuration, the installs, the watcher and Claude Code
  models [--json]                   list the declared models and their rules, with source and cost
  resolve <model> [scope] [place]   show the rules a model receives
  report [--json] [--log <file>]
                                    report from the decision log how often each rule was delivered,
                                    and to which models, scopes and places
  run [--scope <scope>] [--] [claude arguments...]
                                    start claude with the rules for its model in the system prompt
  hook <event>                      the hook adapter that Claude Code runs; not run by hand

Options:
  --help       show this help
  --version    print the version

The configuration is read from $NOONSIGHT_CONFIG, else ~/.config/noonsight/noonsight.json. One file serves every Claude Code account on the machine.`;

export interface Io {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

const COMMAND_USAGE: Record<string, string> = {
  init: INIT_USAGE,
  models: MODELS_USAGE,
  resolve: RESOLVE_USAGE,
  report: REPORT_USAGE,
  install: INSTALL_USAGE,
  uninstall: INSTALL_USAGE,
  check: CHECK_USAGE,
  watch: WATCH_USAGE,
  hook: HOOK_USAGE,
};

export function main(argv: readonly string[], env: Env, io: Io): number | Promise<number> {
  const [command, ...rest] = argv;
  // The hook never prints usage or fails: Claude Code would show it as a hook error.
  if (command === 'hook') return runHookCommand(rest, env, io.out);
  try {
    // Its arguments are claude's, so it reads --help itself, only among its own options.
    if (command === 'run') return runRun(rest, env, io).catch((e: unknown) => handleError(e, io));

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
      case 'init':
        return runInit(rest, env, io);
      case 'models':
        return runModels(rest, env, io.out);
      case 'resolve':
        io.out(JSON.stringify(runResolve(rest, env), null, 2));
        return 0;
      case 'report':
        return runReport(rest, env, io.out);
      case 'install':
      case 'uninstall':
        return runInstall(command, rest, env, io);
      case 'check':
        return runCheck(rest, env, io.out);
      case 'watch':
        return runWatch(rest, env, io);
      case undefined:
        throw new UsageError('missing the command', USAGE);
      default:
        throw new UsageError(`unknown command "${command}"`, USAGE);
    }
  } catch (e) {
    return handleError(e, io);
  }
}

function handleError(e: unknown, io: Io): number {
  if (e instanceof UsageError) {
    io.err(`noonsight: ${e.message}\n\n${e.usage}`);
    return 2;
  }
  if (e instanceof ConfigError) {
    io.err(`noonsight: ${e.message}\nNothing from this configuration was applied.`);
    return 2;
  }
  throw e;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const code = main(process.argv.slice(2), process.env, {
    out: (t) => process.stdout.write(`${t}\n`),
    err: (t) => process.stderr.write(`${t}\n`),
  });
  if (typeof code === 'number') process.exitCode = code;
  else
    void code.then((c) => {
      process.exitCode = c;
    });
}
