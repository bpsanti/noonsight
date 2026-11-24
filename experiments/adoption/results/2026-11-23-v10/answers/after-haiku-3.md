Verdict: adopt with conditions. Start with a pilot on a few people's machines, not a team-wide rollout.

Reasons:
- **Your mix of models is the case it targets.** Each session and subagent gets the rules for the model it runs on, and the rules are re-delivered on model switch, compaction, resume and fork. The README says a single-model team should use a `CLAUDE.md` instead.
- **It covers subagents, where the native alternatives fail.** Your team starts many subagents. In the 2026-11-23 run on Claude Code 2.1.330 (300 generated sessions, 299 completed, 60 per arm), subagent coverage was 763 of 763 under noonsight. A user `CLAUDE.md` reached 60 of 128, `.claude/rules` 60 of 128, and a skill per model 0 of 128 (`experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`).
- **The run covers the paths your team uses.** It included forks, `/resume` in a session, plan mode, subagents that edit files, and sessions started through `noonsight run`. All were covered.
- **Its own rules are measured on real Claude Code sessions.** The API is a local stub, so no model answered, and the measurement is whether rules were delivered, not whether they changed behaviour.
- **The footprint is small and inspectable.** No runtime dependencies. The classifier, which sends the first 4,000 characters of a task to a model, is off by default. `noonsight report` and `noonsight resolve` show what each model receives.
- **The behaviour claims are narrow.** Only `verify-changes` (Sonnet, Haiku) and `carry-through` (Sonnet) showed a measured effect, on small tasks. A pilot on public tasks found no quality difference: 133 of 144 without rules, 132 of 144 under noonsight. Cost also rises: `verify-changes` on Sonnet went from $0.0240 to $0.0505 a run on the fix task.

Conditions and risks:
- **Machine-wide reach.** `noonsight install` adds hooks to every Claude Code login on the account. Pilot on a few named accounts first, and check that `~/.config/noonsight/noonsight.json` stays the same across them.
- **Unattended misclassification.** Interactive sessions count as attended unless `session.unattended_when_env` is set. Set it to your CI or orchestrator variable, or headless runs will get the attended rules.
- **Preset rules that ship off.** Opus's and Fable's attended rules are off by default. Turning one on (`enable`) adds output tokens, by Anthropic's guide: about 70 to 80% for `fable-5-2/code-ownership` and about 20% for `fable-5-2/progress-updates`. Decide these deliberately.
- **Known gaps.** Agents started by a workflow get no rules. Foreground calls of one type that need different rules give their subagents none until each one's first edit or agent call. A plugin that noonsight does not read, such as one your organisation syncs, leaves its subagents on the parent's model. `/fork` is disabled in sessions started by `noonsight run`.
- **Version drift.** The current results are for Claude Code 2.1.330 only. Earlier runs are superseded. Each Claude Code upgrade needs `npm run delivery -- corpus` (needs `claude` and `python3`) before people move to it.
- **Self-measured evidence.** The benchmark, its tests and the preset's sources all come from the same project. Anthropic's excerpts were checked against live pages only if someone runs `NOONSIGHT_LIVE_SOURCES=1 npm run test:live`. I did not run the tests or install anything, so these conditions rest on reading the documents and results.
- **Failure mode.** Hooks never block. A rule that is delivered can still be ignored, so none of this replaces review or the team's own checks.

Before rolling out, the pilot should answer three questions: whether `noonsight report` matches what people see in their sessions, whether the subagent gain holds on your own work rather than the benchmark's tasks, and whether the cost increase is acceptable for your Opus and Fable sessions.

What it guarantees: through Claude Code's hooks, noonsight places each model's declared rules into the requests of every session and subagent that runs on that model, and again after a model change, compaction, clear, resume or fork. That is delivery, not obedience. It rests on the hook mechanism in Claude Code 2.1.330 and on a stub-based benchmark run on 2026-11-23 showing 0 of 299 completed sessions broke the invariant, with the documented exceptions above.
