**Verdict: adopt with conditions.** Run it as a pilot on a few machines first, not a team-wide rollout.

**Reasons**

- **It fixes a real gap in the setup you described.** Mixed models plus many subagents is the case it was built for. In its benchmark, putting every model's rules in a user `CLAUDE.md` or `.claude/rules` reached only 32.2% of subagent requests. `CLAUDE.md` never reaches the built-in Explore and Plan subagents. In those setups only about 27–32% of the rule text a model saw was written for that model. noonsight reached 100% of subagent requests in its latest run (763 of 763, D20).
- **The delivery evidence is unusually solid.** 300 randomised sessions went through `/model`, `/compact`, `/clear`, resumes, forks, plan mode and subagents. Every number links to a raw result file, and `npm test` recomputes it (`docs/evidence.md`). The fuzzer found nine of the tool's own bugs (F1–F9). All are fixed and kept as regression cases, and the latest run had 0 of 300 sessions failing (D18).
- **It is low-risk to run.** The hooks never block anything and use no network unless you turn on the optional classifier. They add about 50–90 ms of CPU per hook run (D15) and can be turned off with `NOONSIGHT_DISABLE=1` or `noonsight uninstall`.
- **It is still immature, which is why there are conditions.** It is version 0.0.1 in `package.json` and not on npm, so you install it by cloning one person's GitHub repo (`bpsanti/noonsight`). Everything was measured on one Claude Code version at a time (2.1.328, then 2.1.330). It also relies on undocumented behaviour, such as the `CLAUDE_CODE_SESSION_ATTENDED` variable.
- **By default it does little for most of your sessions.** Opus 5.5 and Fable 5.2 ship with all their rules for watched (attended) sessions turned off, so your interactive Opus and Fable sessions get nothing from the preset. Sonnet and Haiku sessions get most of their rules only with a scope (`NOONSIGHT_SCOPE`). Its value depends on your team writing rules.
- **The measured benefit of the rules is narrow.** `verify-changes` got Sonnet and Haiku to run tests after a small fix (29/30 and 27/30, against 0/30 with no rules), but it roughly doubled cost ($0.0240 → $0.0505, R6). Every run passed its hidden check with or without rules (R8). Opus was not in the rule experiment at all, and the tasks were small.

**Conditions and risks**

Conditions:
- **Use the same Claude Code version it was checked on, or check yours.** Pin Claude Code to the version in `docs/verification/claude-code.md`, or rerun `npm run test:live` (and ideally the delivery benchmark) before each upgrade. Claude Code changes how hooks behave, and the tool's correctness depends on facts listed per version.
- **Install from a commit you have reviewed.** Install from a pinned, reviewed commit (or a fork your team owns), not a moving `main`. It writes hooks into every Claude Code login on the machine and runs on every session.
- **Mark unwatched sessions.** If you run orchestrators or interactive sessions nobody watches, set `session.unattended_when_env`. Otherwise they count as watched and get the wrong rules.
- **Decide on the off-by-default rules.** Decide with `enable` which preset rules to turn on for Opus and Fable, or write your own. Otherwise most sessions get nothing.
- **Use the reports.** Use `noonsight report` to confirm what was delivered, and drop rules that show no visible effect. Each one costs tokens.

Risks:
- **A Claude Code upgrade can break it silently.** If the undocumented variable is renamed, every headless session falls back to the watched setting and gets those rules instead of its own.
- **Known gaps for subagents.** Workflow agents get nothing. Several foreground subagents of the same type that need different rules get nothing until their first edit. Subagents from a plugin it doesn't read, such as one your organization syncs, get their parent model's rules.
- **Parts that were never tested.** Agent teams, routing, the classifier and `opusplan` were never benchmarked.
- **Smaller edge cases.** `/fork` is refused in sessions started by `noonsight run` with rules. A fork made with `--continue` can pick the wrong original if another session in the same project writes its transcript at the same moment.
- **The model may not follow its rules.** A delivered rule is context, not a command, and the check that a model actually reads the injected context is still marked "Not yet run".
- **There is one maintainer and no published package,** so it could be abandoned.

**What it guarantees**

It guarantees delivery only, not obedience: each session and subagent gets the rules you configured for the model it actually runs on, and none left over from another model. That rests on a benchmark run against a local stand-in for the Claude API (no real model involved), checked against the tool's own rule resolver, on Claude Code 2.1.328 and 2.1.330, and on the hook behaviours listed for those versions continuing to hold.
