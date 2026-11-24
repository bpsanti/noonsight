**Verdict: adopt with conditions.** Pilot it on Sonnet and Haiku build work and subagents first. Don't roll it out as a general quality tool.

**Reasons**

1. **Delivery works as described.** In the delivery benchmark (Claude Code 2.1.330), noonsight delivered rule text to 100% of 3,090 requests and 763 subagent requests. A user `CLAUDE.md` reached 88% of requests and 47% of subagent requests. Built-in Explore and Plan subagents get `CLAUDE.md` rules but not the rules in the built-in Explore and Plan subagents, which is why the setup matters for your team's heavy subagent use. (`docs/usage.md`, rows 14–17; `experiments/benchmark/results/2026-11-19/summary.md`)
2. **The one measured behavior gain is narrow.** On a 12-part triage task, Sonnet 5.5 with `carry-through` finished every part in 32 of 40 runs, against 9 of 40 without it (p < 0.001). Haiku 5.5 with the same rule showed no significant difference: 6 of 40 against 2 of 40 (p = 0.26). (`experiments/rules/results/2026-11-20-harder/summary.md`)
3. **The gains do not extend to other measures.** Tests-after-last-edit, correctness and open-answer judge scores were unchanged across arms. The benchmark's "resolved by verifier" counts were also flat or slightly worse with noonsight. (`docs/usage.md`; `summary.md` in the benchmark results)
4. **Cost rises.** The `verify-changes` rule roughly doubled cost on a cheap task ($0.0015 to $0.0033 per run for Haiku; $0.0240 to $0.0505 for Sonnet on the precise-fix task). Hooks add roughly 80–150 ms of processor time per event on a busy laptop.
5. **Opus and Fable get no rules by default in attended sessions.** Their shipped rules are for unattended or subagent places, so you must enable them or set `unattended_when_env` yourselves. (`docs/usage.md`, "Say when nobody is watching")

**Conditions and risks**

- **Declare every model you run**, including `claude-opus-5-5` and `claude-fable-5-2` (set to `none` if you want no rules). A model with no entry gets a session-start warning and no rules.
- **Give every session a scope** (`NOONSIGHT_SCOPE` or `noonsight run --scope`). Unscoped Sonnet and Haiku attended sessions get only `verify-changes`.
- **Watch for model switches.** In the benchmark, some Opus and Fable runs were auto-switched to `claude-opus-4-8`, which is not declared, so those sessions got no rules or the wrong ones. Rules are keyed to exact model IDs, so a new model version receives nothing until someone declares it.
- **Rules are context, not enforcement.** If something must never happen, use a hook or permission rule instead.
- **Run `noonsight check` in CI or on setup** to confirm what each model receives, and `noonsight report` to see which rules are never delivered.
- **Measure before keeping.** Turn off any rule that never changes what you see, starting with the longest. Each team member should run `noonsight trust` in each shared repository, and the repo's project config can only add rules by default.
- **Evidence limits.** Most effects rest on one or two tasks, with 40 runs per arm. Outcome measures came from Claude Code 2.1.328–2.1.330, and the experiments were run by the project's own authors. Re-run the comparison on your own tasks before relying on it.

**What it guarantees:** Each session and subagent receives only the rule text declared for its exact model, scope and place, and the decision log records what was delivered. That rests on the hooks running (the hook fixtures for Claude Code 2.1.325–2.1.330, and the decision logs from the 2026-11-20 runs), which shows delivery but not that the model follows the rules or that its output improves.

*Scope of this review:* I read the usage docs, configuration docs and the two experiment summaries. I did not run the test suite or install the tool, and I did not check the install path on your machines.
