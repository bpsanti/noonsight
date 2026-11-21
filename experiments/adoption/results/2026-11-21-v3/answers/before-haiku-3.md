**Verdict: Adopt with conditions.** Pilot it on a few machines first. Don't roll it out team-wide yet.

**Reasons**

- **It is built to fail open.** Hooks always exit 0, read only local files, never use the network, and never block or deny a call. A model that isn't declared gets a warning, not a refusal (`docs/hooks.md:9-15`). Its worst case is extra or missing advice, not a stuck session.
- **Delivery is measured across your session types.** In the delivery benchmark on Claude Code 2.1.328, the `on` arm delivered the right model's rules to 99.5% of 3,216 main-session requests and 99.9% of 668 subagent requests. It also covers `/model`, `/clear`, `/compact`, resumes, and edits. The same run shows `CLAUDE.md` covering only 32% of subagent requests, so this is a real gap for your team's subagent-heavy workflow.
- **Sonnet and Haiku have the strongest measured effect.** The `verify-changes` rules made Sonnet run tests after its last edit in 29 of 30 runs on the fix task, against 0 of 30 without rules. Haiku did the same in 27 of 30. Sonnet's bug task went from 11 of 30 to 30 of 30 (`experiments/rules/results/2026-11-20/summary.md`).
- **Routing and the classifier are off by default.** Turning them on is a separate decision. Your team's mixed model choices stay under your control unless someone enables routing.
- **The decision log lets you audit delivery.** `noonsight report` shows which rules fired, for which model, scope, and place. That is something a `CLAUDE.md` can't show you.

**Conditions and risks**

- **Opus and Fable have little measured evidence.** `opus-5-5/unattended-run` was never delivered in the rule experiment. `fable-5-2/finish-work` and `low-context-report` were never delivered there either. Fable's only measured effect is on writing style (shorter sentences, fewer semicolons), from 2026-11-19. Don't expect outcome gains for Opus or Fable sessions.
- **Sonnet's verify rule costs real money.** On the fix task, Sonnet's mean cost per run rose from $0.024 to $0.0505, about +110%. The Haiku rule adds very little. Decide whether that trade is worth it for your routine Sonnet work, or enable the rule only for build scopes.
- **It changes every Claude Code login on each machine.** The default install writes hooks into every Claude Code config directory it finds, and `--managed` needs sudo. Run it per account, and don't ask people to run it on shared machines without telling them.
- **Project config from a repository.** A committed `.noonsight/noonsight.json` applies only after each person runs `noonsight trust`. By default it can add rules but not remove or override yours. Review it like code before anyone trusts it.
- **Early development, unpublished.** The README says "Nothing is published yet." Install is from a clone with `npm link`. Pin a commit and expect breaking changes.
- **Claude Code version drift.** Tests cover Claude Code 2.1.325 through 2.1.329. Confirm your team's version is in that range, and re-run `npm run delivery -- all` after any Claude Code upgrade.
- **Delivery isn't perfect.** The `on` arm had 3 unexplained violations in 60 sessions in the main-session arm (the 300-session run). Coverage is high, not total.
- **Classifier privacy.** If you enable it, the first 4,000 characters of each task go to a model through Claude Code. Check that this is acceptable before turning it on.

**What it guarantees:** noonsight never blocks or denies a call, and its hooks run offline and always exit 0, so it won't stall or fail a session; it also delivers each session's and subagent's configured rules for the model it runs on. The first part rests on the hook implementation and its tests. The second rests on the delivery benchmark, which measured 99.5% coverage for sessions and 99.9% for subagents on one Claude Code version, not on a proof.

*Basis:* I read the README, `docs/hooks.md`, `docs/configuration.md`, and the 2026-11-20 rule and delivery results. I did not install the tool or run its test suite, so the claims above come from its docs and recorded results, not from my own runs.
