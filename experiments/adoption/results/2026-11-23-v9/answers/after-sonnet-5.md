Verdict: adopt with conditions. Trial it on a few machines first, and don't treat it as a quality improvement until you've measured that yourselves.

I read the README, `docs/evidence.md` and `docs/hooks.md`. I did not run the test suite or re-verify any numbers. Everything below is the project's own account of its results.

**Reasons**
- **It fits your setup.** Your team mixes Opus, Sonnet, Haiku and Fable and starts many subagents. Subagents don't see the parent's conversation, and they can run on a different model from it. noonsight predicts the subagent's model before it starts and delivers that model's rules at its start, which is the case it is built for.
- **Delivery is well measured.** On 2026-11-23 the project ran 300 generated sessions on Claude Code 2.1.330 with real interactive sessions and a stubbed API. 299 ran to the end, and none of those broke the invariant. Every one of the 3,090 requests with rules due held them, including 763 of 763 subagent requests (D18–D20).
- **The native alternatives do worse on the same sessions.**

  | Alternative | Requests covered | Subagent requests covered |
  |---|---|---|
  | User `CLAUDE.md` | 88.2% | 46.9% |
  | `.claude/rules` | 76.3% | 46.9% |
  | Skill per model | 0% | 0 of 128 |

  `CLAUDE.md` and `.claude/rules` also put the other models' rules into every request. The project reports 619 and 622 such requests, against 0 for noonsight.
- **Its evidence is unusually honest.** Every number links to a raw result file, and a test recomputes each one. Superseded results are labelled. Nine failures the benchmark found were fixed before the current run. The README lists its own limits.
- **It is low-risk to run.** Its hooks always exit 0, never block a call, and read only local files. The one network feature, the classifier, is off by default. `NOONSIGHT_DISABLE=1` and `noonsight uninstall` turn it off. It reports about 80–150 ms of CPU per hook run on a loaded laptop (D33).
- **It records what it does.** `noonsight report` and `noonsight resolve` show what was delivered and the exact text a model receives, so you can audit it.

**Conditions and risks**
- **Delivery is not obedience, and outcomes are weakly shown.**
  - Some rules had a measured effect on small tasks. On a one-file fix, `verify-changes` took Sonnet's test runs after the last edit from 0 of 30 to 29 of 30. On a 13-ticket backlog, `carry-through` took Sonnet from 9 of 40 complete to 32 of 40.
  - Other rules showed no effect, such as `carry-through` alone on the fix. Opus 5.5's rules have no measured effect at all.
  - A paid pilot on public tasks saw no quality difference: 133, 132 and 133 of 144 passed with no rules, noonsight and `CLAUDE.md`. Verify rules roughly doubled per-run cost on small Sonnet tasks ($0.0240 to $0.0505 on the fix).
  - The pilot only delivered rules to the main conversation, not subagents, and ran on 2.1.326.
  - So the case for adopting is that rules reach the right model, not that your results improve.
- **It out of the box does little for Opus and Fable.**
  - Their attended-session rules ship off, because the cost is high or the benefit is narrow.
  - To get anything on attended sessions you must use `enable`. For Sonnet and Haiku you also need scopes, set through `NOONSIGHT_SCOPE`.
  - Interactive sessions nobody watches, such as CI or orchestrators, need `session.unattended_when_env` set.
  - Budget time to write your own rules, because a rule you write has no measured effect until you measure it.
- **It depends on undocumented Claude Code behaviour.**
  - It relies on hook inputs, fork handling and transcript layout that Claude Code doesn't document, and each result holds only for the version it ran on. Delivery was measured on 2.1.330, and the rule-effect runs used 2.1.328–2.1.329.
  - A Claude Code upgrade could break delivery silently. Pin the version, re-run `npm test` and the live tests on each upgrade, and watch `noonsight report` for rules that go undelivered.
- **Known gaps in delivery.**
  - Workflow agents get nothing. Foreground calls of one type that need different rules get nothing until the subagent's first Edit, Write or agent call.
  - Plugin subagents from an org-synced plugin are predicted on the parent's model.
  - A compacted conversation resumed with no model named runs on Claude Code's default, which noonsight can't tell.
  - Agent teams, routing and the classifier are not measured.
  - `/fork` is unavailable in sessions started by `noonsight run` with rules.
- **Misattribution and setup costs.** Hooks run per machine, so each person must run `noonsight install`. A repo's rules do nothing until each person runs `noonsight trust`. Some rules can still go to the wrong model: a subagent that starts on a different model than predicted gets a warning and keeps the wrong rules.
- **Trial first.** Run it on a few machines for a couple of weeks, with `noonsight report` and your own before/after check on one rule you care about, before rolling it out. Check that the licence (MIT), the npm package and the single-maintainer project fit your supply-chain policy. I didn't assess maintainer or release history.

**What it guarantees**
It guarantees delivery, not obedience: through Claude Code's hooks it puts the rules declared for a model into each session's and subagent's requests, again after a model change, compaction, clear, resume or fork. That rests on a benchmark of real Claude Code 2.1.330 sessions against a stubbed API, with 3,090 of 3,090 due requests covered, and it holds only for that version and the documented limits.
