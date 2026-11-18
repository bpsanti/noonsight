// noonsight trust and noonsight untrust: this account's decision about the project configuration
// found from a directory. A trusted project is laid over the machine's configuration for the sessions
// that run in it, and keeps applying as its file changes; a declined one is left out without a warning.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigError, loadConfigDetails } from '../config/load.js';
import { configPath, stateDir, type Env } from '../config/paths.js';
import { describeProject, findProject, PROJECT_FILE, setTrust } from '../config/project.js';
import type { Io } from '../cli.js';
import { UsageError } from './usage.js';

export const TRUST_USAGE = `usage: noonsight trust [<dir>]
       noonsight untrust [<dir>]

trust: apply the project configuration (${PROJECT_FILE}) found from <dir>, by default the current
directory, up to its repository root, to the sessions that run in that project, laid over the
machine's configuration as its "projects.allow" permits. Trust is kept for the project directory and
this account; later changes to the project's files apply without asking again.
untrust: stop applying it, and stop the warning sessions in the project start with.
Exits 0, 1 when no project configuration is found or the decision cannot be written, and 2 for a usage error.`;

export function runTrust(command: 'trust' | 'untrust', args: readonly string[], env: Env, io: Io, now: Date = new Date()): number {
  const option = args.find((a) => a.length > 1 && a.startsWith('-'));
  if (option !== undefined) throw new UsageError(`unknown option ${option}`, TRUST_USAGE);
  if (args.length > 1) throw new UsageError(`unexpected argument "${args[1]}"`, TRUST_USAGE);
  const home = os.homedir();
  const start = path.resolve(args[0] ?? process.cwd());
  const found = findProject(start);
  if (found === null) {
    io.err(`noonsight: no project configuration (${PROJECT_FILE}) from ${start} up to its repository root.`);
    return 1;
  }
  const trusted = command === 'trust';
  const state = stateDir(home);
  let before: boolean | null;
  try {
    before = setTrust(state, found.dir, trusted, now);
  } catch (e) {
    io.err(`noonsight: could not record the decision in ${state} (${(e as Error).message}).`);
    return 1;
  }
  const decided = trusted ? 'trusted' : 'declined';
  io.out(`project ${found.file}: ${before === trusted ? `already ${decided}` : decided} for this account`);
  if (!trusted) {
    io.out(`sessions in ${found.dir} get only the machine's configuration, without a warning; \`noonsight trust\` there applies it again`);
    return 0;
  }

  // What the project now does, as a session started there reads it.
  const file = configPath(env, home);
  if (!env.NOONSIGHT_CONFIG && !fs.existsSync(file)) {
    io.out(`there is no machine configuration at ${file} yet, so the project applies once \`noonsight init\` writes one`);
    return 0;
  }
  try {
    const { project } = loadConfigDetails(file, { project: { ...found, trusted: true } }, env);
    if (project !== null) {
      io.out(`project ${found.file}: ${describeProject(project)}`);
      for (const note of project.notes) io.out(`note: ${note}`);
    }
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    io.out(`the machine's configuration at ${file} is refused, so nothing applies until it is fixed; run \`noonsight check\` to see the problems`);
  }
  return 0;
}
