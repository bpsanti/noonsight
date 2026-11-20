**Verdict: adopt with conditions.** Pilot it on a few people and a few repositories first. Don't roll it out to the whole team yet.

**Reasons**

- **The delivery claim is measured, but only on a stand-in.** The committed run (`experiments/delivery/results/claude-code-2.1.328/2026-11-20-4e18c43`) covered 99.5% (3,199 of 3,216) of requests with rules due, over 300 random sessions. Every request was read by a local stand-in for the API, and none reached a model. Whether real models behave the same way is untested.
- **It beats the native alternatives on coverage.** On the same 60 sequences, a `CLAUDE.md` covered 87.4% of requests, `.claude/rules` 70.9%, and skills 0%. For subagents, `CLAUDE.md` and `.claude/rules` both covered 32.2%, against 100% with noonsight. `CLAUDE.md` also gives every model the other models' rules: only 31.6% of its rule text was written for the requesting model, against 78.8% under noonsight.
- **The rule effects are real but narrow.** Sonnet and Haiku ran the tests after a precise one-file fix in 30/30 and 27/30 runs with the verify rule, against 0/30 without it. The `carry-through` rule's effect did not show on Haiku. Where the models already did the work, the rules changed nothing and cost a little. Samples were 30 to 40 runs per arm on small tasks.
- **It costs more per run.** The benchmark's pilot found runs cost 7% more under noonsight than with rules off.
- **It is pre-release.** The package is not on npm (0.1 is a placeholder), so install is from a clone. The changelog is one large "Unreleased" block, with many behavior changes made on 2026-11-20 alone.

**Conditions and risks**

Conditions for it to work for us:

- **Pin and verify the Claude Code version.** Delivery was measured on 2.1.328. The docs (`docs/verification/claude-code.md`) list the hook behaviors noonsight depends on, each with the version it was checked on. Check that our version matches one of them. Expect re-verification on every Claude Code upgrade.
- **Pilot first.** Run it on the four models for two weeks on a few repositories. Use `noonsight report` and `noonsight check` to see what was actually delivered, and measure cost and results against sessions without it.
- **Start with a scope, and set `session.unattended_when_env`.** The README says a watched session with no scope gets nothing from the preset. Our team's sessions are mostly interactive, so this matters.
- **Limit the parts that are not measured.** Not measured: `/resume` inside a session, forks, plan mode, agent teams, `noonsight run`, routing, and subagents that edit files. Many of our sessions start subagents, and subagents that edit files are one of the unmeasured cases. Test that path in the pilot before trusting it.
- **Decide how project rules get in.** A committed `.noonsight/noonsight.json` puts text into every teammate's model context once they run `noonsight trust`. Set `projects.allow` to `add` (the default) or `none` on machines where that is safer. Review repo rule files like code.

Risks:

- **Known failures.** The fuzzer found three sessions that broke the invariant. Two (F3 and F4) are fixed but not re-run on the full 300 sessions, so the 99.5% figure is stale. F3 is a resume's delivery lost to another resume, and F4 is a resume after a Sonnet-to-Haiku `/model` switch, which lost 15 requests in one session. A documented limit remains: a compacted session resumed with no model named runs on Claude Code's default.
- **Machine-wide install.** `noonsight install` adds hooks to every Claude Code login on the account, and the watcher for new logins is an opt-in service. Test on a non-production account first.
- **Data egress.** The classifier is off by default. When on, it sends the first 4,000 characters of each task to a small model through the user's own login. Keep it off unless we decide that is acceptable.
- **Overstated results.** Delivery is not obedience. A delivered rule is context only, and the rule-effect data is small.
- **Unknown code.** I read the docs and changelog only. I did not install it or run its test suite, so these conclusions rest on the project's own published results. Before adopting, someone should run `npm test` on a clone and read the hook code that runs at each session start.

**What it guarantees:** In the measured runs, each session and subagent received the rules for the model it ran on, and no other model's rules went unretired, on 99.5% of requests that had rules due, under Claude Code 2.1.328 against a local stand-in for the API. That rests on the delivery benchmark's request-level invariant, checked over 300 random sessions with recorded requests. It does not guarantee that the model follows the rules, and it does not cover versions other than 2.1.328, the unmeasured session types above, or real model traffic.
