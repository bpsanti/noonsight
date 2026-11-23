**Verdict: adopt with conditions.** Pilot it on a few machines at a pinned commit; do not roll it out team-wide yet.

I read the README, the hook contract, the install doc, the evidence map, the preset and its sources, and the pilot benchmark write-up. I did not build it, run its tests, or reproduce any of its numbers, so every figure below is the author's own measurement.

**Reasons**

- **It fits your setup where it matters: subagents.** In its delivery benchmark, a user `CLAUDE.md` holding every model's rules reached 100% of the main conversation's requests but only 32.2% (39 of 121) of subagent requests, and never the built-in Explore and Plan subagents. noonsight reached 100% (763 of 763) of subagent requests in the latest run.
- **It keeps other models' rules out.** With a shared `CLAUDE.md`, only 31.5% of the rule text in a request was written for that request's model, against 79.0% under noonsight. It also adds less text per request (1,155 characters against 4,415).
- **It does not show better results, only better delivery.** In the 588-run pilot, tasks resolved at the same rate with and without it (132 against 133 of 144), at about 7% more cost per run. The README says plainly that delivery is not obedience.
- **The preset gives your attended Opus and Fable sessions nothing.** All their rules for watched sessions ship off. Attended Sonnet and Haiku sessions get only `verify-changes`, after the first edit of a tracked code file. The value for you comes from rules you write yourselves, or from headless runs and subagents.
- **The measured rule effects are narrow and one has a real price.** `verify-changes` made Sonnet run tests after a one-file fix in 29 of 30 runs against 0 of 30, but roughly doubled that run's cost ($0.0240 to $0.0505). Every run passed its hidden check with or without rules.
- **It is very young.** The package is version 0.0.1, marked private, not on npm, installed from a clone, and all results are dated 16 to 23 November 2026. Its own fuzzer found nine delivery failures in that week, all reported as fixed.
- **Its footprint is small and reversible.** It has no runtime dependencies, and the hooks are documented as reading only local files, always exiting 0 and never denying a call. `noonsight uninstall` removes its entries; `NOONSIGHT_DISABLE=1` silences one session.

**Conditions and risks**

- **Pin both versions.** It is measured on one Claude Code version at a time (latest 2.1.330) and relies on several undocumented behaviours. A Claude Code update can silently break delivery, so re-run `noonsight check` and the delivery benchmark after each upgrade.
- **Write your own per-model rules first.** Without them, most of your attended sessions receive nothing and the pilot tells you little.
- **Leave routing and the classifier off.** Neither is measured, nor are agent teams. Routing changes subagent calls, and in auto mode a changed call gets the other calls in that response refused and retried.
- **Check your organisation's settings.** If managed settings set `allowManagedHooksOnly` or `disableAllHooks`, the per-account hooks never run. The machine-wide install is ignored on logins with server-managed settings.
- **Expect per-person setup.** Each person runs `noonsight install`, and `noonsight trust` once per repository with shared rules. Windows is not supported.
- **Known gaps for subagents.** Workflow agents get nothing. Parallel foreground calls of one type needing different rules get nothing until their first edit or agent call. Subagents from organisation-synced plugins are predicted on their parent's model.
- **Undeclared models get a warning, not rules.** In the pilot, Claude Code itself switched sessions to Opus 4.8 and Sonnet 5 on one task; those have no preset rules.
- **Single maintainer.** Someone on your team should own the pin and read the decision log (`noonsight report`) during the pilot.

**What it guarantees**

It guarantees only that each session and subagent is handed the rules declared for the model it actually runs on, with other models' rules retired. That rests on the author's own stub-API benchmark (0 of 300 sessions failing on Claude Code 2.1.330) and on Claude Code's hook behaviour staying as recorded for that version; it does not cover whether the model follows the rules.
