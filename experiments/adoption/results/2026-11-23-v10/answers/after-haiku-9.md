**Verdict:** Adopt with conditions.

**Reasons:**
- **It addresses a gap your setup would otherwise have.** The repo's own measurement shows a user `CLAUDE.md` reaches only 46.9% (60 of 128) of subagent requests, and `.claude/rules` the same. Your team runs many subagents across four models, so per-model rules in a `CLAUDE.md` would miss much of the work. noonsight reported 100% (763 of 763) subagent coverage in its 2026-11-23 run (D20).
- **The delivery claim is specific and checkable.** The headline numbers come from a committed raw file (`summary.json`), and the repo says `npm test` recomputes each number from it (`test/evidence.test.ts`). I did not run the tests, so that check is unverified here.
- **It covers the paths your team hits.** The run includes forks, `/resume`, `/compact`, plan mode, and subagents that edit files (D21: 453 of 453). It is also measured under `noonsight run` and in projects with a trusted configuration (D22).
- **The cost is small on the hook side.** Each hook run takes 80 to 150 ms of CPU (D33), and the tool has no runtime dependencies, which keeps the supply-chain surface small.
- **Its limits are stated.** The README lists the cases it misses, so you can plan around them rather than discover them.

**Conditions and risks:**
- **The quality benefit is not shown.** In the paid pilot (B1), 133 of 144 runs passed without rules, 132 of 144 under noonsight, and 133 of 144 with a `CLAUDE.md`. Treat it as a way to deliver rules reliably, not as a way to get better results.
- **Cost can rise sharply on some rules.** On Sonnet 5.5's fix task, `verify-changes` raised mean cost per run from $0.0240 to $0.0505 (R6). Haiku's absolute cost is tiny, but the relative rise is similar. Check `noonsight report` and cost on your own tasks before you enable rules broadly.
- **Some agents receive nothing.** Workflow agents get no rules. Foreground agents of one type that need different rules get nothing until their first Edit, Write or agent call. Subagents from a plugin that noonsight does not read, such as one your organization syncs, are predicted on their parent's model.
- **Fable and Opus get little by default.** Their attended-place rules ship off, so an attended Fable session receives nothing from the preset until someone turns a rule on with `enable`. Decide which rules your Fable sessions need.
- **Results depend on Claude Code version.** The evidence covers versions 2.1.326 to 2.1.330. Pin your Claude Code version, rerun `noonsight install` after upgrades, and re-check coverage with `noonsight report`.
- **Unattended sessions need a setting.** Interactive sessions nobody watches count as attended unless you set `session.unattended_when_env` to your CI or orchestrator variable.
- **The evidence comes from the project itself.** The benchmark uses synthetic sessions with a stub Messages API, not your real workload, and the author wrote both the tool and the evidence. Run a short pilot on your own repositories before you rely on it.
- **Keep the classifier off unless you review it.** It is off by default. If enabled, it sends the first 4,000 characters of a task to a small model through your login.

**What it guarantees:** Through Claude Code's hooks, noonsight adds the rules declared for each model to the requests of each session and subagent running on that model, and again when the model changes or the conversation is compacted, cleared, resumed or forked. This rests on the hooks running and on the decision log, which measured 3,090 of 3,090 main-conversation and subagent requests with rules due, across 299 simulated sessions on Claude Code 2.1.330. It does not guarantee that the model follows the rules, and it does not cover the gaps listed above.
