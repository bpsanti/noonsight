**Verdict:** adopt with conditions. Run it as a pilot with a few people on a pinned commit and a Claude Code version it was measured on, not as a team-wide rollout yet.

I read the README, the evidence and verification docs, the benchmark results, the changelog and the CI config. I could not run the test suite here, so my check of the numbers is limited to spot-checking the latest delivery run against its raw result file, which matched.

**Reasons:**

- **It fits your setup.** It delivers each model's rules to sessions and subagents, and re-delivers when the model changes. Its own README says to skip it if every session runs one model, which is not your case.
- **It closes a real gap in `CLAUDE.md`.** In its tests, a user `CLAUDE.md` never reached the built-in Explore and Plan subagents and covered 32.2% of subagent requests (39 of 121), against 100% for noonsight. A shared `CLAUDE.md` also gave every model the other models' rules.
- **The delivery claim is well evidenced.** In the latest run, 0 of 299 sessions broke the rule-delivery check and 3,090 of 3,090 requests held their rules, on Claude Code 2.1.330. Every number in the README traces to a committed result file, and its limits are stated plainly.
- **The operational risk is low.** The hooks always exit 0, never block a call, read only local files, use no network and have a 10-second timeout. There are no runtime dependencies, a repository's rules do nothing until each person runs `noonsight trust`, and `noonsight uninstall` removes the hooks.
- **It is very young.** It is version 0.0.1, not on npm (install is from a clone with `npm link`), and all measurements date from 14 to 23 November 2026. Its own fuzzer found nine delivery failures in that time; all are fixed, but the latest fixes landed today.
- **There is no evidence it improves results.** In its 588-run pilot, tasks resolved were 133 of 144 without rules and 132 of 144 with them, at 7% more cost per run. The measured rule effects are on small tasks: Sonnet 5.5 and Haiku 5.5 ran tests after a fix in 29 and 27 of 30 runs with `verify-changes` against 0 of 30 without, at about double the cost on that task.
- **The preset does little for your Opus and Fable sessions.** An interactive session on Opus 5.5 or Fable 5.2 receives nothing from the preset unless you enable rules or write your own.

**Conditions and risks:**

- **You need rules that differ by model.** If your instructions are the same for every model, keep them in `CLAUDE.md`; this tool adds nothing.
- **Pin and re-check on upgrades.** It depends on hook behaviour that changes between Claude Code releases, including one undocumented environment variable. CI pins 2.1.325 while the results are on 2.1.328 and 2.1.330, so rerun its delivery corpus before each Claude Code upgrade.
- **Check your organisation's settings.** If your organisation sets `allowManagedHooksOnly` or `disableAllHooks`, the per-account hooks will not run; `noonsight check` reports this. The machine-wide install is ignored on logins with server-managed settings, and Windows is not supported.
- **Know what is not covered.** Agent teams, routing and the classifier are unmeasured. Workflow agents get nothing, and subagents from organisation-synced plugins may get their parent model's rules.
- **Automatic model fallback is a gap.** In the pilot, Claude Code switched sessions by itself to Opus 4.8 and Sonnet 5. The preset has no rules for those models, so such a session gets only a note that the earlier rules no longer apply.
- **Verify delivery yourselves.** Use `noonsight report` and `noonsight resolve` during the pilot, and drop any rule whose effect you cannot see.
- **It writes to every person's Claude Code `settings.json`.** Each person installs it once, and it adds seven hook entries at about 50 to 90 ms of processor time per hook run.
- **Single maintainer.** It looks like a one-author project with no release yet; plan for it to stall or change shape.

**What it guarantees:** noonsight guarantees that each session and subagent receives the rules written for the model it runs on, not that the model follows them. That rests on its own fuzz tests against a local stand-in for the API on specific Claude Code versions, checked against its own resolver.
