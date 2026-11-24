**Verdict: adopt with conditions.** Run it as a pilot first, not a team-wide rollout.

**Reasons**

1. **It fixes a real gap for how you work.** With several models plus subagents, the built-in options don't hold up. In the tool's own benchmark, a user `CLAUDE.md` reached only 46.9% of subagent requests that should have had rules. It never reaches the built-in Explore and Plan subagents, and it gives every model the other models' rules. noonsight measured 100% (763 of 763) on subagent requests and 3,090 of 3,090 overall (README:31, 39–44).
2. **It's honest and checkable.** The README separates "delivery" from "obedience." It lists its own limits, and each number links to a raw result file that `npm test` recomputes (README:16–26, 265–270). It never blocks a tool call, exits 0, and has a 10-second timeout per hook. It uses no network unless you turn on the classifier, which is off by default (`docs/hooks.md:10-16`). I searched the source and found no network calls outside the experiments folder.
3. **Better delivery doesn't mean better results yet.** In a paid pilot, tasks passed 132 of 144 times under noonsight, 133 of 144 with no rules, and 133 of 144 with a `CLAUDE.md` (B1). Proven effects are narrow: `verify-changes` and `carry-through` on Sonnet/Haiku, and `low-context-report` on Fable, all on small tasks. No Opus rule has a measured effect. `verify-changes` roughly doubled cost per run.
4. **Out of the box it does little for Opus and Fable.** Their rules for watched sessions ship off, so your Opus and Fable sessions get nothing from the preset until you run `enable` (README:52). Sonnet and Haiku get most rules only when a scope is set.
5. **It's very new and depends on Claude Code internals.** It's at version 0.1.0, and all its evidence is from Nov 16–23, 2026; the current delivery run is from today, on Claude Code 2.1.330. Fork handling, `CLAUDE_CODE_SESSION_ATTENDED`, and subagent metadata rely on behavior Claude Code doesn't document (`docs/hooks.md:123, 168, 330`). The benchmark found nine of its own bugs (F1–F9) in the past week, all fixed.

**Conditions and risks**

- **Pin Claude Code versions.** Only adopt if you can run the version it was measured on (2.1.330), or rerun `npm run test:live` and `noonsight check` after each Claude Code upgrade. An upgrade that changes hook behavior could silently break delivery.
- **Have rules that really differ by model.** If your rules are the same for every model, the README itself says to skip it (README:263).
- **Set it up properly:**
  - Set `session.unattended_when_env` for CI and orchestrators.
  - Turn on the Opus and Fable rules you want.
  - Use `NOONSIGHT_SCOPE` or scope `match` patterns.
  - Install with `npm install -g`, not `npx`. An `npx` install stops delivering when npm's cache is cleared.
- **Measure in your pilot.** Use `noonsight report` and watch for `MISMATCH` warnings. Drop rules that change nothing you can see, and track token cost.
- **What could go wrong:**
  - **Workflow agents** get no rules at all.
  - **Subagents predicted on the wrong model:** this happens with plugins noonsight doesn't read, such as org-synced plugins, and with `opusplan` or `default` models.
  - **Parallel subagents of the same type** that need different rules get nothing until their first Edit, Write or agent call.
  - **`/fork` stops working** in sessions started with `noonsight run`.
  - **Agent teams, routing and the classifier** are untested.
  - **Rules don't bind:** a delivered rule is still only context, which the model may ignore.
  - **Undocumented behavior can change.** Anything built on it can break in a later Claude Code release.

**What it guarantees:** It promises only that each session and subagent gets its model's rules in its requests, again after model switches, compaction, clear, resume and fork. That rests on Claude Code's hooks behaving as recorded on the tested versions (2.1.330 for the current run) and on noonsight predicting the right subagent model. It does not guarantee the model follows the rules or that output improves.

I read the docs, the benchmark limits and the evidence index, and searched the source for network use. I didn't run the test suite or recompute the published numbers myself.
