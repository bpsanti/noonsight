**Verdict: adopt with conditions.** Run a time-boxed pilot with a few people before turning it on for the whole team. I read the README, the evidence map, the Claude Code verification table, and the usage and hooks docs. I did not run the tool or its tests.

**Reasons**

- **It fits your setup.** Your team mixes Opus, Sonnet, Haiku and Fable, and many sessions start subagents. noonsight gives each session and each subagent the rules written for the model it actually runs on, and re-delivers them when that model changes. A `CLAUDE.md` can't do this. In the project's own comparison on the same first 60 sequences, subagent requests held their rules 100% of the time under noonsight and 32.2% (39 of 121) with a user `CLAUDE.md` or `.claude/rules`. Of the rule text in a request, 79.0% was written for the request's model under noonsight, against 31.5% for a `CLAUDE.md`.
- **The delivery evidence is strong, with caveats.** It comes from a fuzzing benchmark of 300 random sessions with `/model`, `/compact`, `/clear`, resumes, forks, plan mode and subagents. The result was 99.9% coverage (3,219 of 3,221 requests) on Claude Code 2.1.328. Five more bugs found later were fixed, and the re-run on 2.1.330 gave 100% (3,090 of 3,090) with 0 of 299 sessions broken. Every number links to a raw result file, and the tests recompute each figure. The project reports its own failures (F1 to F9) and its documented limits.
- **The footprint is low.** The hooks never block anything and never use the network. The classifier is the exception, and it is off by default. There are no runtime dependencies. A hook run costs 50 to 90 ms of CPU, and it adds about 1,155 characters per request. `NOONSIGHT_DISABLE=1` and `noonsight uninstall` both undo it.
- **The preset's effects are modest and uneven.**
  - `verify-changes` made Sonnet and Haiku run the tests after a fix in 29 of 30 and 27 of 30 runs, against 0 of 30 without it. It roughly doubled the cost of that task, from $0.0240 to $0.0505.
  - `sonnet-5-5/carry-through` raised completion on a 13-ticket backlog from 9 of 40 to 32 of 40.
  - Haiku's `carry-through` showed nothing.
  - Where the models already did the work, the rules changed nothing.
  - These come from small tasks with 30 or 40 runs per arm. They support giving it a try, not buying it for the preset alone.
- **It is immature.** Version 0.1 is not on npm, so you install it from a clone. It is a single-author project (the repo is `bpsanti/noonsight`). It was renamed from sextant, and its measurements are dated 2026-11-19 to 2026-11-23.

**Conditions and risks**

- **A pinned Claude Code version.**
  - noonsight depends on hook behaviors that are partly undocumented, and it is only measured on one version at a time (2.1.328 and 2.1.330). One example is `CLAUDE_CODE_SESSION_ATTENDED`. If a version drops or renames it, every session is treated as attended.
  - Pin your Claude Code version and re-run `npm run test:live` on every upgrade. A drift would probably fail silently, since delivery is the only thing it promises.
- **It does nothing out of the box for Opus and Fable in attended sessions.**
  - All of the preset's attended rules for those models ship off, so an interactive Opus or Fable session receives nothing from the preset until you `enable` rules.
  - Sonnet and Haiku attended sessions get only `verify-changes`, after a code edit, unless you set a scope.
  - Plan to write your own rules for those models. A rule you write has no measured effect until you measure it.
  - Set `session.unattended_when_env` for any interactive sessions that nobody watches.
- **Subagent gaps.**
  - A workflow's agents get nothing.
  - Foreground subagents of one type that need different rules get nothing until their first Edit, Write or agent call.
  - Plugin subagents that noonsight doesn't read, such as organization-synced ones, are predicted on the parent's model.
  - Agent teams in tmux split panes and the classifier are not measured.
  - If your subagent use goes through those paths, check them in the pilot.
- **Model coverage.** Declare every model you run in the config. A model with no entry gets a warning and no rules. The preset covers only Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5.
- **Hooks must be allowed.** If your organization's managed settings forbid user hooks, it won't run. Run `noonsight check` to find out. The `--managed` install is not tested live.
- **Delivery is not obedience.** The rules are context, so use hooks or permission rules for anything that must never be broken.
- **Measured against a stub API.** No request reached a real model in the benchmark. The behavior studies are separate and small.
- **Setup details.**
  - It edits every Claude Code login's `settings.json`, and `/model` keeps those hook entries (checked on 2.1.325). Back up your settings before installing.
  - Repository configs need a one-time `noonsight trust` per clone.
  - `/fork` doesn't work in `noonsight run` sessions that carry rules.
  - Set `on_preset_change: "hold"` so preset updates don't change behavior without review.
- **Pilot exit test.** After a few weeks, run `noonsight report`. Drop any rule that never changes behavior you can see. If you end up running one model with fixed rules, a `CLAUDE.md` is simpler, and the project says so itself.

**What it guarantees:** For the four supported models, a Claude Code hook delivers each session and subagent the rules written for the model it runs on, including after `/model`, `/compact`, `/clear` and resumes. Concretely, 100% of requests held their rules in a fuzzing benchmark of 299 sessions on Claude Code 2.1.330, run against a local stand-in for the API with no real model involved. It does not guarantee that a model obeys the rules, and it does not cover other Claude Code versions or the documented subagent gaps.
