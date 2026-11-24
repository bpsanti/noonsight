**Verdict: adopt with conditions.**

I read the README, `docs/evidence.md`, and the relevant parts of `docs/hooks.md` and `docs/install.md`. I did not run the tool, the tests or the benchmarks. Every number below is the project's own, taken from its evidence map.

**Reasons**

- **It fits your setup.** It delivers instructions by model, through Claude Code's hooks, and covers each subagent as well as each session. You run several models and many subagents, which is the case it was built for.
- **The delivery numbers are strong and the method is credible.**
  - In the current run (2026-11-23, Claude Code 2.1.330), 300 random sessions across the four models were generated and 299 ran to the end.
  - 0 of those 299 sessions broke the invariant.
  - 3,090 of 3,090 requests with rules due held them, and 763 of 763 subagent requests did.
  - The sessions are real interactive Claude Code sessions. Only the Messages API is a local stand-in, so no model answered.
  - The author also ran the same sequences against native alternatives, and the build before each fix failed (D24).
- **It beats the native options where you are weakest, which is subagents.**
  - A user `CLAUDE.md` reached 46.9% of subagent requests (60 of 128), and `.claude/rules` reached the same.
  - A skill per model reached 0 of 128.
  - A `CLAUDE.md` also puts the other models' rules into every request, so only 32.6% of its rule text was written for the request's model, against 78.6% under noonsight.
  - Under noonsight, no request held another model's rule left unretired.
- **It is low-risk to run.**
  - It never blocks a tool call.
  - A bad configuration is refused whole and logged, not guessed at.
  - It has no runtime dependencies.
  - The only network use is an optional classifier that is off by default.
  - Median hook cost is 80–150 ms of CPU, measured on a loaded laptop.
  - `noonsight uninstall` and `NOONSIGHT_DISABLE=1` undo it.
- **The claims are checked.** `npm test` recomputes every number from the committed raw files. The README states its limits openly, including the failures the benchmark found (F1–F9).
- **Some rule effects are measured, but narrowly.**
  - `verify-changes` raised "ran the tests after the last edit" on Sonnet 5.5 from 0 of 30 to 29 of 30 on one task, and on Haiku 5.5 from 0 of 30 to 27 of 30.
  - `carry-through` on Sonnet 5.5 raised completion of a 13-ticket backlog from 9 of 40 to 32 of 40.
  - `low-context-report` on Fable 5.2 shortened report sentences.

**Conditions and risks**

- **It guarantees delivery, not better work.**
  - No quality gain was shown. In the rule experiments every run passed its hidden check with or without rules (600 of 600).
  - In the paid pilot, 133 of 144 runs passed without rules, 132 under noonsight and 133 with a `CLAUDE.md`. That pilot delivered rules to the main conversation only.
  - Rules raised cost per run in the cases where they changed behaviour. For example, Sonnet 5.5 on the fix cost $0.0505 with `verify-changes` against $0.0240 without it, and $0.145 against $0.155 per run in the pilot.
  - The tasks are small. Treat the effects as results on those tasks, not general ones.
- **The preset does little for Opus and Fable in attended sessions.**
  - Their attended rules ship off, so an interactive Opus or Fable session receives nothing from the preset until you run `enable`.
  - Rules with a measured effect exist only for Sonnet 5.5, Haiku 5.5 and Fable 5.2 (`low-context-report`). No Opus 5.5 rule has a measured effect.
  - You will need to write your own rules and measure them.
- **Known gaps in subagent coverage.**
  - Workflow agents get nothing.
  - Plugin subagents from a plugin it does not read, such as an organization-synced one, are predicted on the parent's model.
  - Foreground calls of one type that need different rules get nothing until each one's first Edit, Write or agent call.
  - Agent teams, routing and the classifier are unmeasured, and split-pane teammates were not checked.
  - If your subagent use leans on these, the benchmark numbers overstate your coverage.
- **A compacted conversation, resumed with nothing naming a model, runs on Claude Code's default model, which noonsight cannot tell.**
  - In that case it may deliver the wrong model's rules.
  - A session started with `noonsight run` and rules cannot `/fork`.
- **Version coupling.**
  - It depends on hook behaviour that Claude Code changes. The results are pinned to Claude Code 2.1.325–2.1.330 and do not all come from the same version.
  - Re-run `noonsight check` and the live tests after each Claude Code upgrade.
- **Installation touches every login.**
  - `noonsight install` edits `settings.json` in every Claude Code config directory it finds. It keeps other hooks and refuses the whole install on invalid JSON.
  - An organization that sets `allowManagedHooksOnly` or `disableAllHooks` blocks user hooks, and then it does nothing.
  - Use the global npm install, not `npx`, because clearing npm's cache silently stops delivery.
- **Unattended sessions must be flagged.** Set `session.unattended_when_env` for CI and orchestrator sessions, or they count as attended and miss their rules.
- **It is a young single-author project.**
  - It was formerly called sextant, and its builds and evidence are from the last week.
  - The repo is not under git here, so I could not check history or maintenance.
  - You would own the rules and the upkeep as models change.
- **The delivery benchmark is the project's own.** An outside reproduction would raise confidence.

**Suggested rollout:** pilot on a few people's machines. Run `noonsight check` and `noonsight report` for a couple of weeks, and look at which rules were delivered and which never fired. Write and measure your own rules for Opus before relying on it there. Then roll out team-wide through a committed `.noonsight/noonsight.json`.

**What it guarantees:** Through Claude Code's hooks, it puts the rules declared for a model into the requests of each session and subagent running on that model, and again when the model changes or the conversation is compacted, cleared, resumed or forked; that rests on a 300-session benchmark of real Claude Code sessions against a stub API, run on one Claude Code version (2.1.330) and by the author. It does not guarantee that the model follows the rules.
