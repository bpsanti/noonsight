**Verdict: adopt with conditions.** Pilot it on one or two repos first, and make the Sonnet and Haiku rules a measured choice, not a default.

**Reasons**

- It fits your mix. It writes a rule set per model (Fable 5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5) and delivers each one to the session or subagent actually running that model. The alternative, a single `CLAUDE.md`, misses subagents: the README's 2026-11-23 benchmark shows it reached 46.9% of subagent requests that had rules due, against 100% for noonsight (763 of 763).
- Delivery is well covered. The 2026-11-23 run (Claude Code 2.1.330, 300 generated sessions) reports 0 of 299 completed sessions breaking the invariant, and 3,090 of 3,090 requests with rules due holding them. Those requests include forks, `/resume`, plan mode and subagents that edit files.
- The one measured behavior change is on small tasks. `verify-changes` on Sonnet 5.5 raised "tests run after the last edit" from 0 of 30 to 29 of 30 on the fix task, and from 11 of 30 to 30 of 30 on the bug task. The same rule on Haiku 5.5 went from 0 of 30 to 27 of 30 on the fix. These are small tasks, and the README says so.
- It runs on Claude Code's own hooks, has no runtime dependencies, and its hooks never block a call. It also writes a decision log, so you can check what was delivered (`noonsight report`).
- The project publishes its failures. The delivery benchmark lists nine earlier failures (F1 to F9), all fixed before the current run.

**Conditions and risks**

Conditions for it to work for us:
- **Pin and re-test on Claude Code upgrades.** The results are per Claude Code version: the rule experiment ran on 2.1.329 and the delivery benchmark on 2.1.330. Re-run `npm test` or the benchmark after each upgrade.
- **Set `session.unattended_when_env`** to your CI or orchestrator variable. Otherwise an interactive session nobody watches counts as attended and gets the wrong rules.
- **Check the known gaps against your workflows.** Per the README, these get no rules or the wrong ones:
  - a workflow's agents;
  - foreground agents of one type that need different rules, until their first Edit, Write or agent call;
  - plugins noonsight does not read, which leave subagents on the parent's model;
  - a conversation compacted with nothing since that names a model, which runs on the default model;
  - `/fork` in a session started by `noonsight run`.
- **Budget for the cost.** In the delivery benchmark's paid runs, average input tokens per run rose about 34% on Sonnet ($0.070 to $0.086 per run) and about 36% on Haiku. In the rule experiment, `verify-changes` on Sonnet roughly doubled the cost of the fix task ($0.024 to $0.051 per run).
- **Enable rules deliberately.** The Opus 5.5 and Fable 5.2 attended rules ship off. The README's rule-effect experiment did not run most preset rules, and the paid pilot on public tasks found no measurable quality difference (133 of 144 passed without rules, 132 of 144 with noonsight).
- **Review repo rule files like code.** Their text goes into model context. Each person must run `noonsight trust` before a repo's `.noonsight/` config takes effect; keep that step and review changes to those files.
- **Run your own A/B on your tasks** before rolling it out widely. `noonsight report` shows what was delivered, not whether the model changed its behavior.

Risks:
- **Install touches every login.** `noonsight install` adds hooks to every Claude Code login on the account, keeping other settings. Some team members may not want that.
- **Duplicate delivery.** A login with both the plugin and `noonsight install` runs two copies of each hook; they are de-duplicated, but a pre-claims copy delivers twice.
- **Evidence is self-published.** The numbers come from the project's own benchmark and experiment, and the README says a self-check recomputes them. I read the documentation and results; I did not run the test suite or the benchmark.
- **An earlier run looks worse.** The 2026-11-19 benchmark summary shows 55% delivery after a model switch on Haiku in the `on` condition. The README says later builds fixed the failures behind this, and the 2026-11-23 run reports 100% on those paths. I did not check the raw 2026-11-23 results for that path.
- **Classifier is off by default.** If turned on, it sends the first 4,000 characters of a task to a small model through the person's Claude Code login.

**What it guarantees:** Through Claude Code's hooks, noonsight puts the rules declared for each session's and subagent's actual model into its requests, again after a model change, compaction, clear, resume or fork, and it does not guarantee the model follows them. That rests on the hook contract and the project's 2026-11-23 benchmark (3,090 of 3,090 requests, 0 of 299 sessions broken), within the limits the README lists.
