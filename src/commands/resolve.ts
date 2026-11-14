import { configPath, type Env } from '../config/paths.js';
import { loadConfig } from '../config/load.js';
import { resolve } from '../core/resolve.js';
import { PLACES, type Decision, type Place } from '../core/types.js';
import { UsageError } from './usage.js';

export const RESOLVE_USAGE = `usage: sextant resolve <model> [--scope <scope>] [--place session|unattended|subagent]

Print, as JSON, the decision for a model: the rules it receives and the exact text that would be
delivered, "none" when the configuration decided it needs no rules, or "undeclared".
The place defaults to "session". An empty model ("") stands for a tool that reported no model.`;

export function runResolve(args: readonly string[], env: Env): Decision {
  let model: string | undefined;
  let scope: string | null = null;
  let place: Place = 'session';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    const [flag, inline] = arg.startsWith('--') && arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    const value = (): string => {
      const v = inline ?? args[++i];
      if (v === undefined || v === '') throw new UsageError(`${flag} needs a value`, RESOLVE_USAGE);
      return v;
    };
    if (flag === '--scope') scope = value();
    else if (flag === '--place') {
      const p = value();
      if (!(PLACES as readonly string[]).includes(p)) throw new UsageError(`unknown place "${p}"`, RESOLVE_USAGE);
      place = p as Place;
    } else if (arg.startsWith('-') && arg !== '-') throw new UsageError(`unknown option ${arg}`, RESOLVE_USAGE);
    else if (model === undefined) model = arg;
    else throw new UsageError(`unexpected argument "${arg}"`, RESOLVE_USAGE);
  }
  if (model === undefined) throw new UsageError('missing the model', RESOLVE_USAGE);

  const config = loadConfig(configPath(env), {}, env);
  return resolve(config, { model, scope, place });
}
