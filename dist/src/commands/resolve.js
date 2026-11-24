import { configPath, stateDir } from '../config/paths.js';
import { loadConfigDetails } from '../config/load.js';
import { projectFor } from '../config/project.js';
import { resolve } from '../core/resolve.js';
import { placeName } from '../core/types.js';
import { UsageError } from './usage.js';
export const RESOLVE_USAGE = `usage: noonsight resolve <model> [scope] [attended|unattended|subagent]

Print, as JSON, the decision for a model: the rules it receives and the exact text that would be
delivered, "none" when the configuration decided it needs no rules, or "undeclared".
The place defaults to "attended", a session someone is watching; "session", its earlier name, is
also read. An empty model ("") stands for a tool that reported no model,
and an empty scope ("") for no scope, so a place can be given without one. A project configuration
found from the current directory applies as it would to a session started here.`;
export function runResolve(args, env) {
    const option = args.find((a) => a.length > 1 && a.startsWith('-'));
    if (option !== undefined)
        throw new UsageError(`unknown option ${option}`, RESOLVE_USAGE);
    const [model, scopeArg, placeArg = 'attended', ...extra] = args;
    if (model === undefined)
        throw new UsageError('missing the model', RESOLVE_USAGE);
    if (extra.length)
        throw new UsageError(`unexpected argument "${extra[0]}"`, RESOLVE_USAGE);
    const place = placeName(placeArg);
    if (place === null)
        throw new UsageError(`unknown place "${placeArg}"`, RESOLVE_USAGE);
    // As a session started here would: the machine's configuration, with this directory's project over it.
    const file = configPath(env);
    const { config } = loadConfigDetails(file, { project: projectFor(env.CLAUDE_PROJECT_DIR || process.cwd(), file, stateDir()) }, env);
    return resolve(config, { model, scope: scopeArg || null, place });
}
//# sourceMappingURL=resolve.js.map