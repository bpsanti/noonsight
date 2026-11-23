**Verdict:** Adopt with conditions. Pilot it on a few people's machines first, and keep to the conditions below.

**Reasons:**
- It fits your mix of models. It picks rules by model, scope, place and trigger, so Opus, Sonnet, Haiku and Fable sessions each get their own rules. A `CLAUDE.md` cannot do that, and `.claude/rules` reached only 76.3% of requests in their benchmark.
- Subagents are where the native options fail, and you run many of them. Their benchmark reports 763 of 763 subagent requests with rules, against 46.9% for a `CLAUDE.md` and 0% for a skill per model. Note that the README says a `CLAUDE.md` never reaches the built-in Explore and Plan subagents.
- It records what it delivered. `noonsight report` and `noonsight resolve` let you check what each model receives, which you can't do with a `CLAUDE.md`.
- It has no runtime dependencies, reads only local files, and the hooks never use the network. The only network path is the classifier, which is off by default.
- The effect data is modest. The rule-effect results come from small tasks with 30–40 runs per arm. The clearest effect is `verify-changes` on Sonnet and Haiku, which made them run tests after a one-file fix in 27–29 of 30 runs, against 0 of 30 without it. It also roughly doubled the cost of a small fix. Opus's rules have no measured effect.

**Conditions and risks:**
- **Check the claim yourselves.** I did not run the tool. The guarantee comes from the author's own benchmark, run on a local stand-in API, so no model answered. Install from a clone (`npm install && npm run build && npm link`; it is not on npm yet), then confirm with `noonsight report` on a few real sessions of each model, including a subagent.
- **Pin Claude Code.** Results were measured on 2.1.330 (the delivery claim), 2.1.329 and 2.1.326 (rule effects). The README says Claude Code's hook behavior changes between versions. Pin the version you test, and rerun `noonsight check` and the report after each upgrade.
- **Set `session.unattended_when_env`.** Interactive sessions nobody watches count as attended by default, so Opus and Fable's unattended rules won't reach them. Set it to your CI or orchestrator variable.
- **Decide on the attended rules.** Opus's and Fable's attended rules ship off. Turn them on with `enable` only if you measure a benefit.
- **Review repository config like code.** A committed `.noonsight/noonsight.json` changes what every model receives after each person runs `noonsight trust`. Review those files in pull requests, the same as the rule text they point to.
- **Hooks are installed for every login.** `noonsight install` adds hooks to every Claude Code account on the machine. An organization can turn them off with `disableAllHooks` or `allowManagedHooksOnly`, and `noonsight check` reports that case.
- **Known gaps:**
  - A conversation compacted with no response since, then resumed with nothing that names a model, runs on Claude Code's default model, and noonsight cannot tell.
  - Workflow agents receive nothing.
  - Subagents whose rules are not yet known run on their parent's model until their first Edit, Write or agent call.
  - Agent teams, routing and the classifier are not measured.
  - `/fork` is unavailable in sessions started with `noonsight run` that have rules.
- **Don't expect obedience.** Delivery is not the same as the model following a rule. Measure any rule you rely on, and drop the ones that change nothing you can see.

**What it guarantees:** noonsight guarantees that a session or subagent receives the rule text written for the model it runs on, and receives it again when the model changes, and in the author's benchmark it did so on 3,090 of 3,090 requests with rules due (Claude Code 2.1.330, 2026-11-23); that rests on Claude Code's hooks and on a benchmark that used a local stand-in API, so it shows delivery, not that the model follows the rule.
