**Verdict:** adopt with conditions, as a time-boxed pilot on a few machines rather than a team-wide rollout.

This is based on the repository's documentation and committed results; I did not run its tests or audit the source.

**Reasons**

- **It fits your setup.** Its own docs say to skip it when every session runs one model with fixed rules. You run four models and many subagents, which is the case it is built for.
- **Its edge over a plain `CLAUDE.md` is in subagents.** In its benchmark a `CLAUDE.md` reached 100% of main-conversation requests (448 of 448) but only 46.9% of subagent requests (60 of 128), and it never reaches the built-in Explore and Plan subagents. noonsight reached 763 of 763.
- **It sends each model less irrelevant text.** 78.6% of the rule text in a request was written for that model, against 32.6% with a `CLAUDE.md`, and it added about 1,343 characters per request against 4,472.
- **Evidence that this improves results is thin.** In the paid pilot on public tasks, pass rates were 133, 132 and 133 of 144 with no rules, with noonsight and with a `CLAUDE.md`. That pilot delivered rules to the main conversation only, so it did not test the subagent advantage.
- **Only a few shipped rules have a measured effect, all on small tasks with 30–40 runs per arm.**
  - `verify-changes` made Sonnet and Haiku run tests after a small fix (0 of 30 without, 29–30 and 27 of 30 with), at about double the cost of that fix. All 600 runs passed the hidden check either way.
  - Sonnet's `carry-through` raised completed backlog runs from 9 to 32 of 40; Haiku's showed nothing.
  - Fable's `low-context-report` shortened report sentences.
  - No Opus rule has a measured effect.
- **Out of the box it does little for Opus and Fable.** Their rules for attended sessions ship off, so an interactive session on either gets nothing from the preset. The value for you would come mostly from rules you write yourselves, and those have no measured effect until you measure them.
- **It is very young.** It is version 0.0.1, not on npm (you install from a clone), and the whole changelog is "Unreleased". Its own benchmark found nine delivery failures (F1–F9) in about a week; all are fixed, the last ones in the run dated today.
- **The operational risk is low.** The hooks never block a call, always exit 0, use no network (unless you turn on the optional classifier), and have no runtime dependencies. `noonsight uninstall` removes them, and every delivery is logged for `noonsight report`.

**Conditions and risks**

- **You must be allowed to install user hooks.** If your organization's managed settings forbid them, it cannot work; `noonsight check` reports this.
- **Pin the Claude Code version.** The delivery claim is measured on 2.1.330 only, and several of the failures came from model-reporting quirks in resume, fork and plan mode. It also reads an undocumented environment variable, the `claude` command line via `ps`, and transcript files. Re-run its delivery benchmark before each upgrade.
- **Known gaps to check against how you work:**
  - Workflow agents get nothing.
  - Agent teams, routing and the classifier are unmeasured.
  - Subagents from organization-synced plugins may be predicted on the wrong model.
  - Parallel foreground subagents of one type that need different rules get nothing until their first edit or agent call.
  - `/fork` is refused in sessions started through `noonsight run` with rules.
  - A conversation compacted and then resumed with no model named can get the wrong model's rules.
- **Scoped rules need setup.** Subagents get a scope only from match patterns you write or from the classifier, which sends the first 4,000 characters of a task to a small model. Without either, scoped preset rules such as `fable-5-2/finish-work` are not delivered to subagents.
- **Unattended interactive sessions need a flag.** Set `session.unattended_when_env` for CI or orchestrated sessions, or they are treated as attended.
- **Repository rules need a per-person step.** Each person must run `noonsight trust` in each clone, or the repository's configuration silently does nothing.
- **Rules cost tokens even when they change nothing.** The pilot's mean cost per run was $0.145 without rules and $0.155 with noonsight (a `CLAUDE.md` cost $0.173). Each hook run also takes roughly 80–150 ms of CPU.
- **Define success before you start.** Pick two or three rules you care about, measure them on your own tasks with and without, and drop the tool if `noonsight report` shows deliveries but you see no change. If subagents are not where your problems are, a `CLAUDE.md` is simpler.
- **Single-maintainer risk.** It appears to be one person's repository, renamed once already (from sextant), and it would sit in every login's settings.

**What it guarantees**

It guarantees delivery, not obedience: each request of a session or subagent carries the rules configured for the model it actually runs on and no other model's unretired rules. That rests on one benchmark run of 299 real Claude Code sessions against a stand-in API on Claude Code 2.1.330, judged against noonsight's own resolver, and on hook behaviour that Claude Code can change in any release.
