**Verdict: Adopt with conditions.**

I read the README, `docs/evidence.md` and `docs/verification/claude-code.md`. I did not run anything, so every number below is the project's own, not mine.

**Reasons**
- **It fits your setup.** It delivers rules per model to each session and each subagent, and the preset covers Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5. It re-delivers them when the model changes or the conversation is compacted, cleared, resumed or forked.
- **Delivery beats the native options on subagents.** The current run (Claude Code 2.1.330, 2026-11-23) found 100% delivery under noonsight: 3,090 of 3,090 requests with rules due, and 763 of 763 for subagents ([D19](docs/evidence.md#d19), [D20](docs/evidence.md#d20)). Without it, on the first 60 sequences, a `CLAUDE.md` reached 46.9% of subagent requests (60 of 128) and `.claude/rules` the same ([D28](docs/evidence.md#d28)). Skills reached 0 of 579 requests ([D27](docs/evidence.md#d27)).
- **A `CLAUDE.md` is fine for the main conversation.** It covered 448 of 448 requests there ([D34](docs/evidence.md#d34)). It also never reaches the built-in Explore and Plan subagents.
- **It keeps other models' rules out.** In the benchmark, a `CLAUDE.md` or `.claude/rules` left 619 and 622 requests holding another model's rules with no note retiring them. noonsight left none ([D32](docs/evidence.md#d32)).
- **The evidence is unusually careful.**
  - Each number links to a raw result file, a Claude Code version and a date. Tests recompute the numbers.
  - The authors found and fixed nine failures of their own (F1 to F9).
  - The documented limits are stated openly.
- **The runtime cost is small.** It has no runtime dependencies, never blocks anything, and the network is used only by an optional classifier that is off by default. A hook run takes about 80 to 150 ms of CPU on a loaded laptop ([D33](docs/evidence.md#d33)). It adds about 1,343 characters per request, against about 4,400 for a `CLAUDE.md` ([D31](docs/evidence.md#d31)).

**Conditions and risks**
- **Delivery is not obedience, and quality gains are unproven.**
  - A delivered rule is only context. The measured behaviour changes are narrow, mostly "ran the tests after the last edit" on small tasks. For example, Sonnet went from 0 of 30 to 30 of 30 on a precise one-file fix.
  - The preset's Opus rules have no measured effect.
  - The paid pilot on public tasks showed no difference in pass rate: 133 of 144 without rules, 132 with noonsight ([B1](docs/evidence.md#b1)).
  - Verification rules roughly doubled the cost per run on small tasks: Sonnet went from $0.0240 to $0.0505 ([R6](docs/evidence.md#r6)).
  - Pilot first, and drop rules that change nothing you can see. `noonsight report` shows what was delivered, not whether it helped.
- **Most of the preset is off or scoped for attended sessions.**
  - Opus and Fable rules for attended sessions ship off. Those sessions get nothing until you `enable` a rule.
  - Sonnet and Haiku scoped rules need `NOONSIGHT_SCOPE` or a matching trigger.
  - Interactive sessions that nobody watches count as attended unless you set `session.unattended_when_env`. Do that for your orchestrators.
  - Plan on writing your own rules. The preset is only a starting set.
- **Known delivery gaps matter if you use these features.**
  - A workflow's agents get nothing.
  - Foreground calls of one subagent type that need different rules get nothing until that subagent's first Edit, Write or agent call.
  - A plugin noonsight does not read, such as one an organization syncs, leaves its subagents predicted on the parent's model.
  - A compacted conversation resumed with nothing that names a model runs on Claude Code's default model, which noonsight cannot detect.
  - `/fork` is unavailable in sessions started with `noonsight run`.
  - Agent teams, routing and the classifier are not measured.
- **It depends on Claude Code internals that can change.**
  - It reads the parent process's `--model` argument via `ps`.
  - It reads the undocumented `CLAUDE_CODE_SESSION_ATTENDED` variable.
  - It relies on specific hook timing for subagents.
  - Results hold only for the versions measured: the current run is 2.1.330, and CI pins 2.1.325 for its live checks.
  - Pin your team's Claude Code version, rerun `npm test` and the live checks (`npm run test:live`) on each upgrade, and treat a Claude Code release as a possible delivery regression.
- **The benchmark never involved a real model.** It used real interactive sessions against a stub API, so it proves what was in each request, not what any model did with it.
- **Shared rule files need a trust step.** Repository rules in `.noonsight/noonsight.json` do nothing until each person runs `noonsight trust`. Decide who owns the team rule files and how they are reviewed.
- **It is a young project.** It was renamed from sextant, and its results date from mid-November 2026. Check maintenance before you depend on it.

**What it guarantees**
Through Claude Code's hooks, noonsight guarantees that the rules declared for a model are put into the requests of each session and subagent running on that model, and again when the model changes or the conversation is compacted, cleared, resumed or forked. This rests on a benchmark of 300 random real interactive sessions against a stub API, where 0 of 299 completed sessions broke the invariant, and on the documented limits above. It guarantees delivery as context, not that any model follows a rule.
