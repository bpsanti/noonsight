**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines with your own rules, not as a team-wide default yet.

I read the README, evidence map, hook contract, preset sources, delivery benchmark README, package manifest and plugin launcher, and searched the source for network and process use. I did not run the tests or the tool: there is no built `dist/` here and I had no shell.

## Reasons

- **It fits your setup.** It delivers rules per model to each session and subagent, and redelivers on `/model`, compaction, `/clear`, resume and fork. Its own README says to skip it if every session runs one model.
- **The gap it closes is in subagents.** In its benchmark a user `CLAUDE.md` reached 100% of main-conversation requests (448 of 448) but only 46.9% of subagent requests (60 of 128). noonsight held 763 of 763, and 3,090 of 3,090 overall.
- **It avoids cross-model clutter.** With one `CLAUDE.md` holding every model's rules, only 32.6% of the rule text in a request was written for that model, against 78.6% under noonsight.
- **No outcome gain is shown.** The paid pilot passed 133 of 144 runs without rules, 132 under noonsight and 133 with a `CLAUDE.md`. The measured effects are behavioural: Sonnet ran tests after a fix in 29 of 30 runs against 0 of 30.
- **Rules cost money.** `verify-changes` roughly doubled the cost of a small Sonnet fix ($0.0240 to $0.0505) and added about 54% on the bug task.
- **The preset does little for attended Opus and Fable sessions.** Their attended rules ship off, and Opus has no subagent rule at all. Scoped rules stay dormant unless you set `NOONSIGHT_SCOPE` or write matchers.
- **It is young.** It is version 0.1.0 from a single author, and all committed runs date from 16 to 23 November 2026. Its benchmark found nine delivery failures in that week; all are fixed, with reproductions kept.
- **The evidence is unusually honest.** Every number links to a raw file, limits are stated beside the guarantee, and superseded results are kept and labelled. I spot-checked only the `CLAUDE.md` figures against `summary.json`; they match.
- **The footprint is low.** There are no runtime dependencies. The source starts only `git`, `ps`, `claude` and, for the optional watcher, `launchctl`/`systemctl`, and I found no network code. The hooks exit 0 and never deny a call.

## Conditions and risks

Conditions:
- **Pin and re-check Claude Code.** The delivery numbers hold for 2.1.330 only, and CI's live checks pin 2.1.325. Re-run the corpus (`npm run delivery -- corpus`, no login or tokens) before each Claude Code upgrade.
- **Write your own rules.** Put what differs by model in noonsight and keep shared rules in `CLAUDE.md`. Measure any rule you care about; the tool says a rule of your own has no measured effect until you do.
- **Mark unattended sessions.** Set `session.unattended_when_env` for orchestrated interactive sessions, or the unattended rules never fire.
- **Review the logs weekly.** Check `noonsight report` and the `MISMATCH` and `calls-differ` lines to see what subagents received.
- **Install per account, from npm.** A machine-wide install cannot be turned off by `disableAllHooks`. Leave routing and the classifier off: neither is measured, and the classifier sends task text to a model.

Risks:
- **Silent breakage on a Claude Code update.** It relies on undocumented behaviour: `CLAUDE_CODE_SESSION_ATTENDED`, `forkedFrom`, the background job's `state.json`, and subagent metadata.
- **Known gaps for subagent-heavy use.** Workflow agents get nothing. Parallel calls of one subagent type needing different rules get nothing until their first Edit, Write or agent call. Subagents from organization-synced plugins are predicted on the parent's model. Agent teams are unmeasured.
- **The benchmark's reference is its own resolver.** A wrong resolution would not show, only a wrong delivery. Sessions ran against a stand-in API with the preset's rules.
- **Overhead and side effects.** Each hook costs about 80 to 150 ms of CPU. `/fork` is unavailable in sessions started by `noonsight run` with rules. A local decision log records file paths.

## What it guarantees

It guarantees delivery, not obedience: the rules declared for a model are put into the requests of each session and subagent running on it, which rests on Claude Code's hooks behaving as recorded on version 2.1.330.
