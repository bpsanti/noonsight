// Routing in Claude Code: what counts as a model the caller already chose, how a routing table's
// model is written for each target, and what the decision log records about a route.
//
//   launcher    noonsight run adds --model and --effort to the claude command line. A model is written
//               as the table writes it, an alias or an identifier, since --model takes both.
//   subagents   the agent call hook sets the call's model and effort parameters. The model parameter
//               takes an alias only (https://code.claude.com/docs/en/sub-agents, "Choose a model"),
//               so an identifier is written as the alias that selects it, when one does.
import { normalizeModel } from '../../core/normalize.js';
import { ROUTE_ALIASES } from '../../core/types.js';
import { isSet, resolveModelValue } from './launch.js';
/** The variable that, when set, wins over the effort a command line or an agent call sets. */
export const EFFORT_ENV = 'CLAUDE_CODE_EFFORT_LEVEL';
/** How noonsight run writes a table's model for --model, and the model that selects. */
export function launcherTranslation(env) {
    return (model) => {
        const r = resolveModelValue(model, env);
        if (r.kind === 'unresolved')
            return { why: `"${model}" cannot be pinned down: ${r.why}` };
        return { value: model, model: r.model };
    };
}
/**
 * How the agent call hook writes a table's model for the call's model parameter, and the model that
 * selects. `select` predicts the subagent's model for a given parameter, as Claude Code decides it.
 */
export function subagentTranslation(select) {
    return (model) => {
        if (ROUTE_ALIASES.includes(model)) {
            const selected = select(model);
            return selected !== null ? { value: model, model: selected } : { why: `noonsight cannot tell which model "${model}" selects for this subagent` };
        }
        const target = normalizeModel(model);
        const alias = ROUTE_ALIASES.find((a) => select(a) === target);
        return alias !== undefined
            ? { value: alias, model: target }
            : { why: `the agent tool takes a model alias only, and no alias selects ${target} for this subagent` };
    };
}
/**
 * The model a subagent call already has, from the prediction of its model without routing. A fork and
 * CLAUDE_CODE_SUBAGENT_MODEL_FORCE fix the model whatever the call asks; a model parameter, a
 * definition, a built-in subagent's own model and a definition noonsight cannot read are the caller's
 * or the author's choice.
 */
export function subagentHeld(prediction) {
    switch (prediction.source) {
        case 'fork':
            return { reason: 'fork', explicit: false };
        case 'forced':
            return { reason: 'model-forced', explicit: false };
        case 'parameter':
            return { reason: 'explicit-model', explicit: true };
        case 'definition':
            return { reason: 'definition-model', explicit: true };
        case 'built-in':
            return { reason: 'built-in-model', explicit: true };
        default:
            return prediction.definition === 'not-read' ? { reason: 'definition-not-read', explicit: true } : null;
    }
}
/** What the decision log records for a call routing never got to decide on, such as under a refused configuration. */
export function notRouted(reason) {
    return { routing: 'off', routing_reason: reason };
}
/** What the decision log records about a route. */
export function routeFields(route, env) {
    const fields = { routing: route.routing, routing_reason: route.reason };
    if (route.routing === 'yielded' && route.env !== undefined)
        fields.routing_env = route.env;
    if (route.routing === 'inherit' && route.from !== undefined)
        fields.route_from = route.from;
    if (route.routing === 'routed') {
        fields.route_model = route.model;
        fields.route_value = route.value;
        if (route.effort !== undefined)
            fields.route_effort = route.effort;
        if (route.effortKept)
            fields.route_effort_kept = true;
        fields.route_option = route.option;
        if (route.effort !== undefined && isSet(env[EFFORT_ENV]))
            fields.route_effort_overridden_by = EFFORT_ENV;
    }
    if ((route.routing === 'routed' || route.routing === 'inherit') && route.skipped.length > 0)
        fields.route_skipped = route.skipped;
    return fields;
}
//# sourceMappingURL=routing.js.map