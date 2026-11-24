**Verdict: adopt with conditions.** Run it as a pilot on a few machines, for the rules you write yourselves, not as a team-wide rollout on the strength of its preset.

I read the README, the hooks contract, the evidence map, the preset and its sources, the install notes, the CI file and the changelog. I could not run the tests or the benchmarks, and I only skimmed the source for process and network use, so every number below is the repo's own claim.

**Reasons**

- **It targets your gap.** In its benchmark a user `CLAUDE.md` reached every main-conversation request but only 46.9% (60 of 128) of subagent requests, while noonsight reached 100% (763 of 763). `CLAUDE.md` also sends every model the other models' rules.
- **The preset gives your sessions little by default.** Attended Opus and Fable sessions receive nothing, and Opus subagents receive nothing. Sonnet and Haiku subagents get `carry-through`, Fable subagents get `low-context-report`, and attended Sonnet and Haiku sessions get `verify-changes` after their first edit of a tracked code file.
- **Scoped rules stay dormant.** The preset's scopes ship with no matchers, so those rules reach nothing until you set `NOONSIGHT_SCOPE`, write matchers, or turn on the classifier.
- **No quality gain is shown.** The paid pilot passed 133 of 144 runs without rules, 132 under noonsight and 133 with a `CLAUDE.md`. Only three rules have a measured effect alone, all on small tasks, and no Opus rule has one.
- **Some rules cost money.** `verify-changes` roughly doubled Sonnet's cost on a one-file fix ($0.0505 against $0.0240) and made it run tests in 29 of 30 runs against 0 of 30, with no change in pass rate.
- **It is very young.** It is version 0.1.0 from one author, and every result is dated within the last week. Its own fuzzing found nine delivery failures in that week, all fixed.
- **Failure is cheap.** Hooks always exit 0, never deny a call, have no runtime dependencies, and use no network with the classifier off. A broken hook means missing rules, not a blocked session.

**Conditions and risks**

- **Claude Code version drift.** Fork, plan-mode and subagent matching rely on Claude Code behaviour the docs call undocumented, recorded on 2.1.325 to 2.1.330. Pin Claude Code during the pilot and check `noonsight report` after each upgrade.
- **You need model-specific rules of your own.** If the same rules suit every model, a `CLAUDE.md` is simpler, as the README itself says.
- **Unmeasured or uncovered paths.**
  - Agent teams, routing and the classifier are not measured; leave routing and the classifier off.
  - Workflow agents get nothing.
  - Parallel foreground subagents of one type that need different rules get nothing until their first edit or agent call.
  - Subagents from organization-synced plugins are predicted on the parent's model.
- **Platform and policy.** It needs Node.js 20 or newer on macOS or Linux; Windows is not supported. An organization that sets `allowManagedHooksOnly` or `disableAllHooks` stops the per-account install.
- **Repo-level rules need a per-person step.** Each person runs `noonsight trust` once per repository; until then the committed file does nothing, silently apart from a startup warning.
- **Overhead.** Each hook run takes about 80 to 150 ms of processor time, and state and a decision log accumulate under `~/.local/state/noonsight/`.
- **The evidence is self-graded.** The delivery benchmark uses a stub API, and its reference is noonsight's own resolver, so a wrong resolution would not show.

**What it guarantees**

It guarantees that the rule text declared for a model is put into the requests of sessions and subagents running on that model — delivery, not obedience — and that rests on Claude Code's hooks behaving as they did on the versions the author tested, as measured by the author's own stub-API benchmark.
