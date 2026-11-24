**Verdict:** Adopt with conditions. Pilot it on one or two repositories first, and roll it out only after you have checked the delivery on your own Claude Code version.

**Reasons:**
- Your team runs four models and many subagents, which is the case the tool targets. Its benchmark (`experiments/benchmark/results/2026-11-19/summary.md`) reports that with its hooks on, rule text written for the session's model reached 100% of the 168 runs, while the `CLAUDE.md` condition reached only 18–29% of the rule text for the run's model, because it mixes every model's rules.
- For subagents, the README's comparison table shows 100% of 763 subagent requests with rules due were covered (`README.md` lines 37–47). `CLAUDE.md` reached 46.9% of them, and a skill per model reached 0%. Explore and Plan subagents never receive `CLAUDE.md`. This is the strongest argument for your team, since many of your sessions start subagents.
- The one measured rule effect is narrow but real. In `experiments/rules/results/2026-11-20/summary.md`, Sonnet 5.5's and Haiku 5.5's `verify-changes` rule raised the share of runs that ran tests after their last edit from 0/30 to 27–29/30 on the fix task, with p < 0.001.
- The tool is clean in the ways that matter for adoption: no runtime dependencies, MIT license, hooks that never block, and a `NOONSIGHT_DISABLE=1` switch and an `uninstall` command for reversing it.
- The cost is modest in absolute terms. The benchmark's cost per run rose from $0.071 to $0.084 on Sonnet and $0.298 to $0.325 on Fable. Haiku's per-run cost is a fraction of a cent either way.

**Conditions and risks:**
- **The evidence is the author's own, with a local API stand-in.** Sessions were real Claude Code sessions, but the Messages API was a local stub, so no model answered in the delivery benchmark. Most rule-effect runs were on small fixture tasks, and the authors say the results are not general effects. Reproduce the delivery check on your own setup before you depend on it.
- **Pin and re-verify the Claude Code version.** Every result is tied to a version (2.1.330 for delivery, 2.1.328 and 2.1.329 for rule effects). If your team's versions differ, run `noonsight report` and `noonsight resolve` on your own machines first.
- **Model switches are a gap for your team.** The benchmark's model-switch rows show sessions moving to other models automatically (for example, Opus 5.5 to `claude-opus-4-8`). Under the `on` condition, the after-model-switch path delivered 55% of the rule text for the new model, against 100% on the other paths (summary, "Share of the rule text written for the request's model"). I did not resolve that discrepancy from the docs. Ask the authors, or test it, before relying on rules to follow a switch.
- **Opus and Fable get little from the preset in attended sessions.** Their attended rules ship off, and no Opus or Fable rule has a measured effect beyond Fable's `low-context-report`, which was measured only on 2.1.328. Turn on anything you want for these models only after measuring it.
- **Quality was not shown to improve.** The paid pilot found 133/144 passing without rules, 132/144 with noonsight, and 133/144 with `CLAUDE.md`. The tool is worth it for delivery and consistency, not for measurably better code.
- **Cost doubles for the verify rule on some tasks.** Sonnet's per-run cost went from $0.024 to $0.051 on the fix task and from $0.032 to $0.049 on the bug task, because the model runs more tests and output tokens. Decide whether that is worth it per workflow.
- **Operational setup:**
  - Set `session.unattended_when_env` to your CI or orchestrator variable. Otherwise interactive sessions nobody watches count as attended.
  - Repository rules need `noonsight trust` once per clone, and until then they change nothing.
  - Sessions started through `noonsight run` cannot use `/fork`.
  - Agent teams, routing and the classifier are not measured. The classifier is off by default, and when enabled it sends the first 4,000 characters of a task to a model over the network.
- **Keep `CLAUDE.md` for what every model needs.** The tool's own advice is the same.

**What it guarantees:** Through Claude Code's hooks, noonsight puts the rules declared for a model into the requests of each session and subagent running on that model, and again when the model changes or the conversation is compacted, cleared, resumed or forked. That rests on Claude Code's hook behavior on the tested versions, and on the author's benchmark of 299 sessions with 3,090 requests, which were checked against a local API stand-in. It does not guarantee the model follows the rules.

I did not run the test suite or the live tests, and I only read the README, the docs and the two result summaries.
