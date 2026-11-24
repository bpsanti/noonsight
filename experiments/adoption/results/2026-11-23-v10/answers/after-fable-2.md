**Verdict: adopt with conditions.** Run it as a pinned pilot on a few machines, not a team-wide rollout. If you have no model-specific rules of your own to deliver, the shipped preset alone does not justify it.

I read the README, the hooks, install and evidence docs, the preset sources, the changelog and the experiment summaries. I did not run the test suite, recompute numbers from the raw result files, or audit the source beyond a search for network and process calls.

## Reasons

- **Delivery is well tested.** In the current run (Claude Code 2.1.330), 0 of 299 sessions broke the delivery invariant, and all 3,090 requests with rules due held them, including 763 subagent requests.
- **It closes a real subagent gap.** A user `CLAUDE.md` reached every main-conversation request but only 60 of 128 subagent requests, and never reaches the built-in Explore and Plan subagents. It also gives every model the other models' rules.
- **No gain in task success is shown.** In the paid pilot, the verifier passed 133 of 144 runs with no rules, 132 with noonsight and 133 with a `CLAUDE.md`. In the fix and bug experiment, all 600 runs passed their hidden check with or without rules.
- **Measured effects are narrow behaviours.**
  - Sonnet and Haiku ran tests after a one-file fix in 30 and 27 of 30 runs, against 0 without rules.
  - Unattended Sonnet finished a 13-ticket backlog in 32 of 40 runs, against 9.
  - Fable wrote shorter report sentences.
  - No Opus rule has a measured effect, and Haiku's `carry-through` showed none.
- **The preset does little for your Opus and Fable interactive sessions.**
  - Attended Opus and Fable sessions receive nothing by default.
  - No Opus rule targets subagents at all.
  - Attended Sonnet and Haiku sessions get `verify-changes` only after editing a tracked code file.
- **It costs tokens.** The pilot averaged $0.155 per run against $0.145 without rules, and Sonnet went from $0.070 to $0.086. `verify-changes` alone roughly doubled the cost of a small Sonnet fix ($0.0505 against $0.0240).
- **It is very young.** This is version 0.1.0 from a single author, with about ten days of history. The benchmark found nine delivery failures in that time, all fixed, across Claude Code 2.1.326 to 2.1.330.
- **The footprint is small and reversible.** It has no runtime dependencies and an MIT licence. The hooks read only local files, never block a call, and `noonsight uninstall` removes them.

## Conditions and risks

Conditions:
- **Have rules worth delivering.** Write your own per-model rules, or confirm you want the specific measured behaviours above.
- **Pin versions.** Pin the noonsight version, set `"on_preset_change": "hold"`, and re-run its delivery corpus on each new Claude Code version before upgrading.
- **Check your environment.** It needs macOS or Linux and Node.js 20 or newer. Run `noonsight check` on each machine, because an organisation that sets `allowManagedHooksOnly` or `disableAllHooks` stops the hooks.
- **Plan the rollout per person.** Each person installs it, re-runs `noonsight install` after upgrades, and runs `noonsight trust` once per repository that carries shared rules.
- **Measure on your own tasks.** `noonsight report` counts deliveries, not effects.

Risks:
- **Claude Code changes can break delivery.** Several mechanisms rest on undocumented behaviour recorded on 2.1.330: fork origins, the headless variable and subagent metadata.
- **Some of your subagents get nothing.** That covers workflow agents, and subagents from organisation-synced plugins that set their own model, which get the parent model's rules. Parallel same-type calls needing different rules get theirs late or never. Split-pane agent teams are unchecked.
- **Some models cannot be identified.** Sessions on `default` or `opusplan`, aliases on Bedrock or Vertex without pinning, and automatic fallbacks to older models get a warning and no rules.
- **Scope-limited rules stay dormant.** The preset has no scope matchers, so they need `NOONSIGHT_SCOPE`, your own matchers, or the classifier, which uses the network and costs money.
- **The benchmark has blind spots.** It uses a stub API, one seed, and noonsight's own resolver as the reference, so a wrong resolution would not show. Routing, the classifier and agent teams are unmeasured.
- **It adds overhead and trust.** Each hook run starts a Node process (80 to 150 ms of CPU, measured under load). A single-author npm package gains the ability to add text to every session.

## What it guarantees

noonsight guarantees that the rules declared for a model are placed in the requests of each session and subagent running on that model, and again after a model switch, compaction, clear, resume or fork. It does not guarantee the model follows them. The guarantee rests on Claude Code's hook behaviour as recorded on version 2.1.330, within the documented limits above.
