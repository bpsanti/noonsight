// Routing: from a task's scope to a model and an effort. Pure, like the rest of the core: the adapter
// passes the environment, what the caller already chose, and how an option's model is written for the
// target, as data.
//
// Routing acts only when it is on, for a target it lists, outside an environment that makes it yield,
// and where the caller has not already chosen the model. Then the scope's row for the target, else
// routing.default, lists options in order of preference, and the first whose model is declared under
// "models" wins. In every other case the call is left as it is, and the decision says why. The scope
// and the rules never depend on routing: they are decided the same way whether a route applies or not.
import { declares } from './resolve.js';
/** The environment variable that turns routing off for a session and everything it starts. */
export const ROUTING_ENV = 'NOONSIGHT_ROUTING';
/** NOONSIGHT_ROUTING values that turn routing off. */
const OFF_VALUES = ['off', '0', 'false', 'no'];
/** Whether NOONSIGHT_ROUTING turns routing off. */
export function routingEnvOff(env) {
    return OFF_VALUES.includes((env[ROUTING_ENV] ?? '').trim().toLowerCase());
}
/**
 * Whether routing can act at all for a target in an environment: the decision every task there gets
 * before its scope or its model is looked at, or null when routing may act.
 */
export function routingGate(config, target, env) {
    const r = config.routing;
    if (!r.enabled)
        return { routing: 'off', reason: 'disabled' };
    if (!r.targets.includes(target))
        return { routing: 'yielded', reason: 'target-off' };
    if (routingEnvOff(env))
        return { routing: 'yielded', reason: 'routing-env', env: ROUTING_ENV };
    const yieldEnv = r.yieldWhenEnv.find((name) => (env[name] ?? '') !== '');
    if (yieldEnv !== undefined)
        return { routing: 'yielded', reason: 'yield-env', env: yieldEnv };
    return null;
}
/** Whether a model the call already has keeps routing out. */
function holds(config, held) {
    return held !== null && (!held.explicit || config.routing.respectExplicit);
}
/**
 * Whether routing would read the task's scope for a call: it may act for the target in the
 * environment, and no model the call already has keeps it out.
 */
export function routeReadsScope(config, request) {
    return routingGate(config, request.target, request.env) === null && !holds(config, request.held);
}
/** Decide the model and effort a task is routed to, or why it is left as it is. */
export function route(config, request) {
    const r = config.routing;
    const gate = routingGate(config, request.target, request.env);
    if (gate !== null)
        return gate;
    if (request.held !== null && holds(config, request.held))
        return { routing: 'yielded', reason: request.held.reason };
    const fromTable = request.scope !== null ? rowFor(r.table.get(request.scope), request.target) : undefined;
    const fromDefault = rowFor(r.default ?? undefined, request.target);
    const [options, from] = fromTable !== undefined ? [fromTable, 'table'] : [fromDefault, 'default'];
    if (options === undefined)
        return { routing: 'inherit', reason: request.scope === null ? 'no-scope' : 'no-row', skipped: [] };
    if (options.length === 0)
        return { routing: 'inherit', reason: 'empty-row', from, skipped: [] };
    const skipped = [];
    for (const [i, option] of options.entries()) {
        const t = request.translate(option.model);
        if ('why' in t) {
            skipped.push({ model: option.model, why: t.why });
            continue;
        }
        if (!declares(config, t.model)) {
            skipped.push({ model: option.model, why: `${t.model} is not declared under "models"` });
            continue;
        }
        return {
            routing: 'routed',
            reason: from,
            value: t.value,
            model: t.model,
            ...effortOf(option, request.explicitEffort && r.respectExplicit),
            option: i,
            skipped,
        };
    }
    return { routing: 'inherit', reason: 'no-declared-option', from, skipped };
}
function rowFor(row, target) {
    return row?.[target];
}
function effortOf(option, keep) {
    if (option.effort === undefined)
        return {};
    return keep ? { effortKept: true } : { effort: option.effort };
}
//# sourceMappingURL=route.js.map