**Verdict: adopt with conditions.** Run it as a time-boxed pilot with a few people, with your own rules, not as a team-wide rollout yet.

I read the README, changelog, docs and committed result summaries, and grepped the source for network and process use. I did not run the test suite or the benchmarks, so the numbers below are the repo's own.

**Reasons**

- **It fits your setup.** It delivers per-model instructions to sessions and subagents through Claude Code hooks, and re-delivers them after `/model`, `/compact`, `/clear`, resumes and forks.
- **It closes a real gap with subagents.** In its delivery benchmark, a shared `CLAUDE.md` put the right rules in 32.2% of subagent requests (39 of 121), because it never reaches the built-in Explore and Plan subagents. noonsight reached 100% (763 of 763 in the latest run).
- **It keeps other models' rules out.** With `CLAUDE.md`, about 31.5% of the rule text a model read was written for it; with noonsight, 79.0%.
- **The preset does little for attended sessions.** Attended Opus and Fable sessions receive nothing from it. Attended Sonnet and Haiku sessions get only `verify-changes`, and only after editing a tracked code file. Most of the value would come from rules you write yourselves.
- **No effect on task success was shown.** In its 588-run benchmark, tasks resolved were 133 of 144 without it and 132 of 144 with it, at about 7% more cost per run. The measured effects are behavioural, on small tasks: for example, Sonnet ran tests after a fix in 29 of 30 runs with the rule against 0 of 30 without, at roughly double the cost of that cheap task.
- **It is very young.** It is version 0.0.1, not published to npm (install is from a clone), everything in the changelog is "Unreleased", and Windows is unsupported. Its own fuzzer found nine delivery failures (F1–F9) within about a week, all fixed, the last ones in a run dated today.
- **The footprint is low-risk.** It has no runtime dependencies, the hooks always exit 0 and never block, and I found no network calls in `src/`. The only outbound path is the optional classifier, off by default. `noonsight uninstall` removes the hooks.

**Conditions and risks**

- **Pin versions.** Delivery is measured on one Claude Code version at a time (latest 2.1.330) and relies on undocumented behaviour, such as `CLAUDE_CODE_SESSION_ATTENDED` and transcript formats. A Claude Code update can silently break delivery, so pin a noonsight commit and re-run `noonsight check` after each update.
- **Write your own rules and declare every model.** An undeclared model gets a warning and no rules. In the benchmark some sessions auto-switched to older models (`claude-sonnet-5`, `claude-opus-4-8`) that the preset has no rules for.
- **Keep always-on rules in `CLAUDE.md`.** Use noonsight only for what differs by model, task type or subagent, and use hooks or permission rules for anything that must never happen.
- **Know the subagent gaps.** Workflow agents get nothing. Parallel same-type subagent calls needing different rules get nothing until their first Edit, Write or agent call. Agent teams in split panes, routing and the classifier are unmeasured.
- **Check managed settings.** If your organisation sets `allowManagedHooksOnly` or `disableAllHooks`, the hooks will not run.
- **Leave routing and the classifier off.** Routing changes subagent calls and interacts with auto mode; the classifier sends task text to a model.
- **Expect per-person setup.** Each person installs from a clone, and runs `noonsight trust` once per repository that carries shared rules.
- **Measure before keeping a rule.** `noonsight report` counts deliveries, not effects; a rule can add cost and change nothing.
- **Single-maintainer risk.** The project appears to be one author's repository; plan for it going unmaintained.

**What it guarantees**

It guarantees delivery, not obedience: each session and subagent request carries the rules configured for the model it actually runs on. That rests on its own fuzz benchmarks against a local stand-in API on specific Claude Code versions (0 of 299 sessions broke this in the latest run), not on any contract from Claude Code.
