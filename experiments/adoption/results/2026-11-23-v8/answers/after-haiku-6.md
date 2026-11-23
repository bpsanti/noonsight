**Verdict: adopt with conditions.** Pilot it on one or two machines first, and pin the Claude Code version.

**Reasons**

- **It targets your actual problem.** Your sessions run on four models and start subagents, and the tool's job is to give each session and subagent the rules for the model it actually runs on, re-delivering them when the model changes. It works through Claude Code's own hooks (`SessionStart`, `PostModelSwitch`, `PreToolUse`/`SubagentStart` on the agent tool), so it doesn't depend on your `CLAUDE.md` alone.
- **The native alternatives cover less.** In the repo's own benchmark, on the same run, a user `CLAUDE.md` covered 88.2% of requests and 46.9% of subagent requests. `.claude/rules` covered 76.3% and 46.9%. A skill per model covered 0%. The tool covered 100% (3,090 of 3,090) and 100% of subagent requests (763 of 763) (`docs/evidence.md` D19, D20, D25–D29).
- **Subagents are the main gap in plain `CLAUDE.md`.** The docs say it never reaches the built-in Explore and Plan subagents. Since your team starts many subagents, that matters more than the top-level session.
- **It fails safe.** Hooks always exit 0, never block or deny a call, make no network calls, and refuse a bad configuration whole rather than guessing (`docs/hooks.md`). That limits the blast radius on a daily-use team tool.
- **It is auditable.** `noonsight report` shows each rule's deliveries, and every decision is logged locally, so you can check what was delivered rather than trust it.
- **Its own rule-effect data is mixed, so don't adopt it for quality gains.** `verify-changes` made Sonnet 5.5 and Haiku 5.5 run tests after a small fix in 29/30 and 27/30 runs, versus 0/30 without it, but it roughly doubled that run's cost ($0.0240 to $0.0505, R3/R6). Opus 5.5 has no measured rule effect, and `carry-through` on Haiku showed none (R11).

**Conditions and risks**

- **Pin and re-verify the Claude Code version.** The headline delivery result is measured only on Claude Code 2.1.330. Its hook behaviour depends on undocumented details it reads (for example, the `CLAUDE_CODE_SESSION_ATTENDED` variable and `/fork` background-job files). Before upgrading Claude Code, re-run `npm test` and the delivery experiment, or check `noonsight report` for anomalies.
- **Decide the place for each model.** Attended Opus 5.5 and Fable 5.2 sessions get no preset rules by default, since those rules ship off. Turn on any you want with `enable`. Headless and subagent sessions get the preset's unattended rules.
- **Set `session.unattended_when_env`** to your CI or orchestrator variable, or your watched-nobody interactive runs will be treated as attended.
- **Know the known gaps.** Subagents started from a workflow, from a plugin the tool doesn't read, or in a split-pane agent team are not covered. A compacted conversation resumed with nothing naming a model runs on Claude Code's default, which the tool can't see. `/fork` is unavailable in a session started by `noonsight run` with rules.
- **Install is from a clone.** The package is private, version 0.0.1 (the README says 0.1, which is not yet published), and there's no npm release. Someone has to own the install and upgrades.
- **Per-repo rules need trust.** Each person who clones a repo must run `noonsight trust` before its `.noonsight/` config takes effect, and until then it silently changes nothing.
- **Costs and overhead.** Each hook run takes about 80–150 ms of CPU on a loaded laptop (D33), and some rules add tokens and cost. The optional classifier sends the first 4,000 characters of a task to a small model through your login, so leave it off unless you need it.
- **Don't read "delivered" as "obeyed".** The guarantee is that the rules reach the request. The docs say a delivered rule is context, not a command.
- **Evidence is self-reported.** The benchmark used a local stand-in for the API, so no model answered, and the numbers come from the authors' own runs. I did not run `npm test` or the experiments, and this directory is not a git checkout, so I could not check the commit hashes they cite. Running `npm test` in your environment is the first step in the pilot.

**What it guarantees:** every Claude Code session and subagent gets the rules written for the model it runs on, and gets them again when the model changes, which rests on hook-based delivery measured on 2026-11-23 on Claude Code 2.1.330 across 299 simulated sessions (0 broke the invariant), with the API stubbed out so no model answered, and it does not guarantee that the model follows those rules or that delivery holds on other Claude Code versions.
