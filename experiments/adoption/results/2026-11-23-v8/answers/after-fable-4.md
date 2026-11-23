**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines, pinned to one Claude Code version, and only if you have rules that really differ by model. It is not ready for a team-wide rollout.

I read the README, docs, changelog and result files. I could not run the test suite or the tool in this session, so the numbers below are the repository's own; I spot-checked only a few against the raw result files.

**Reasons**

- **It fits your setup.** It delivers per-model rules to sessions and subagents, and handles `/model` switches, resumes, forks and compaction. In its own benchmark a user `CLAUDE.md` reached 100% of the main conversation's requests (448 of 448) but only 46.9% of subagent requests (60 of 128), because it never reaches the built-in Explore and Plan subagents. noonsight reached 763 of 763.
- **It keeps other models' rules out.** With one `CLAUDE.md` holding every model's rules, only about a third of the rule text a model saw was written for it (32.6%, against 78.6% under noonsight).
- **The evidence is unusually honest.** Every number traces to a committed raw file, superseded results are labelled, and limits are stated. The hooks have no runtime dependencies, use no network, always exit 0 and never block a call.
- **It is very young.** It is version 0.0.1, marked private, not on npm (install is from a clone), and has a single author. The headline run is dated today.
- **Its failure history suggests more to come.** The benchmark found nine delivery failures in about a week. Five of them appeared as soon as new paths (forks, plan mode, in-session `/resume`) were added to the test generator.
- **Better outcomes are not shown.** In the paid pilot, tasks resolved in 133, 132 and 133 of 144 runs without rules, with noonsight, and with a `CLAUDE.md`. noonsight's runs cost about 7% more than no rules.
- **The preset does little for attended Opus and Fable sessions.** Their attended rules ship off, so those sessions receive nothing until you enable rules or write your own. No Opus rule has a measured effect at all.
- **The measured effects are narrow.** `verify-changes` made Sonnet and Haiku run tests after a small fix (29 and 27 of 30 runs, against 0 without), but it roughly doubled that fix's cost and every run passed its hidden check either way. `carry-through` on Sonnet raised fully completed backlogs from 9 to 32 of 40; the same rule on Haiku showed nothing.

**Conditions and risks**

- **You need model-specific rules.** If your rules are the same for every model, a `CLAUDE.md` is simpler, as the README itself says. The value here is mostly your own rules, not the preset.
- **Pin Claude Code and re-verify on upgrade.** The delivery claim is measured on 2.1.330 only, and Claude Code moved from 2.1.325 to 2.1.330 in nine days. The tool relies on undocumented behaviour: the `CLAUDE_CODE_SESSION_ATTENDED` variable, transcript and subagent metadata formats, and reading the parent process command line with `ps`.
- **Check the paths you use against the unmeasured list.** Agent teams, routing, the classifier and `opusplan` are not measured, and workflow agents get nothing. Subagents from organization-synced plugins are predicted on their parent's model.
- **Failures are silent.** A missed delivery never blocks anything, so someone has to review `noonsight report` and `noonsight check` regularly during the pilot.
- **Label unattended sessions.** Interactive sessions count as attended unless you set `session.unattended_when_env` to your orchestrator's variable; otherwise the unattended rules will not reach them.
- **It touches every login.** `noonsight install` writes hooks into every Claude Code login's settings, and must be re-run after upgrades. Each hook run costs about 80–150 ms of processor time, on session start, model switches, agent calls and edits.
- **Repository rules are an injection surface.** A committed `.noonsight/noonsight.json` puts text into every teammate's context once they run `noonsight trust`, so review changes to it like code.
- **`noonsight run` disables `/fork`.** Claude Code refuses to fork a session the launcher started with rules.
- **One maintainer.** Decide who on your team owns it if upstream stops; the code is MIT-licensed and small enough to fork.

**What it guarantees**

It guarantees delivery, not obedience: each session and subagent request carries the rules configured for the model it runs on, with other models' rules retired. That rests on one fuzz run of 299 sessions against a stand-in API on Claude Code 2.1.330, checked against noonsight's own resolver, and on Claude Code hook behaviour that is partly undocumented.
