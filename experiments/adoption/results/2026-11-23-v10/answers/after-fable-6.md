**Verdict: adopt with conditions.** Pilot it with your own per-model rules; do not roll it out for the shipped preset alone.

I read the README, the hook contract, the evidence map, the Claude Code verification list, the preset sources, the delivery benchmark write-up and its raw summary. I did not run anything: this copy has no build and I have no shell, so the numbers below are the repository's own, spot-checked against one committed result file.

## Reasons

- **It closes a real gap for subagents.** Without noonsight, a `CLAUDE.md` reached every main-conversation request but only 60 of 128 subagent requests, and never reaches the built-in Explore and Plan subagents. Under noonsight the figure was 763 of 763.
- **It keeps other models' rules out.** With a `CLAUDE.md` or `.claude/rules`, only about a third of the rule text in a request was written for that request's model. For mixed Opus/Sonnet/Haiku/Fable use, this is the main benefit.
- **The delivery evidence is good, but narrow.** The current run had 299 completed sessions and 3,090 requests with rules due, with none missing. The headline figures I checked match the committed `summary.json`. The sessions were real Claude Code sessions against a stand-in API, so no model answered.
- **The preset gives your attended sessions almost nothing.** Opus and Fable interactive sessions receive no preset rule by default. Sonnet and Haiku receive `verify-changes` only after editing a tracked code file. Most scoped rules stay dormant because nothing detects a scope unless you set one.
- **No quality gain is shown.** The paid pilot passed 133 of 144 runs without rules, 132 under noonsight and 133 with a `CLAUDE.md`. The measured effects are behavioural, on small tasks: Sonnet ran tests after a fix in 29 of 30 runs against 0 of 30, at roughly double the (tiny) cost per run.
- **It is low-risk to try.** It has no runtime dependencies, its hooks never block a call, and it uses the network only if you turn the classifier on. `noonsight uninstall` removes it, and every delivery is logged for `noonsight report`.
- **It is young.** It is version 0.1.0 from a single author, and the current benchmark run is dated today. Nine delivery failures were found and fixed in the past week.

## Conditions and risks

Conditions:
- **Write your own rules.** You need rules that differ by model; if you have none, a `CLAUDE.md` is simpler, as the README itself says.
- **Pin and re-verify the Claude Code version.** Results hold only for the version they ran on (2.1.330 for delivery). Re-run `noonsight check` and the live tests before each team-wide upgrade.
- **Set scope and place deliberately.** Set `NOONSIGHT_SCOPE` or scope matchers, and `session.unattended_when_env` for unwatched interactive sessions; otherwise most scoped rules never fire.
- **Review repository rules like code.** A committed `.noonsight/noonsight.json` puts text into every trusting teammate's sessions; each person must run `noonsight trust` once.
- **Leave routing and the classifier off.** Neither is measured, and routing in auto mode causes sibling agent calls to be refused and retried.

Risks:
- **Dependence on undocumented Claude Code behaviour.** It reads an undocumented environment variable, transcript fields, subagent metadata files and, on macOS, `ps` output. A Claude Code update can silently misplace or drop deliveries.
- **Subagent gaps.** Workflow agents get nothing. Agent teams are unmeasured. Subagents from organization-synced plugins are predicted on the parent's model. Parallel same-type calls needing different rules get nothing until their first edit or agent call.
- **Other documented limits.** `/fork` is unavailable in sessions started by `noonsight run` with rules. A resume after a compaction with no response since can get the wrong model's rules.
- **Self-referential benchmark.** The reference is noonsight's own resolver, so a wrong resolution would not show, only a wrong delivery.
- **Overhead.** Each hook run costs about 80 to 150 ms of processor time, and rules such as `verify-changes` add tokens.
- **Platform.** The machine-wide install does not support Windows.

## What it guarantees

noonsight guarantees that the rules declared for a model are placed in the requests of each session and Agent-tool subagent running on that model, and again after a model switch, compaction, clear, resume or fork. That is delivery, not obedience, and it rests on Claude Code's hook behaviour as checked on version 2.1.330, some of it undocumented.
