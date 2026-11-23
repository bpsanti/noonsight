**Verdict: adopt with conditions.** Pilot it first, don't roll it out to everyone yet. I read the README, the evidence map, the delivery benchmark design and the Claude Code verification table. I did not run the tests or the install myself, so everything below is the project's own reported evidence.

**Reasons**
- **It fits your setup.** You run several models and many subagents. That is the case where `CLAUDE.md` falls short. In the project's benchmark on the same 60 session sequences, a user `CLAUDE.md` put the right rules in 87.3% of requests but only 32.2% of subagent requests. noonsight got 100% on both ([D5, D6, D9, D10](docs/evidence.md)).
- **The delivery claim is carefully measured.**
  - 300 random sessions on Claude Code 2.1.330 covered `/model`, `/compact`, `/clear`, resume, fork, plan mode and subagents that edit files. None of the 299 that finished broke the invariant, and 3,090 of 3,090 requests with rules due held them ([D18, D19](docs/evidence.md)).
  - The fuzzer found nine real bugs, F1 to F9, and each has a reproduction in the corpus.
  - They checked that the harness can catch bugs by planting faults in a copy of the build.
  - A test recomputes every README number from the raw result files.
- **The design is low-risk.** It uses local hooks only, reads local files, never blocks anything and has no runtime dependencies. You can turn it off per session with `NOONSIGHT_DISABLE=1`, and `noonsight uninstall` removes it. `noonsight report` and `resolve` let you see what each model received.
- **The authors state the limits.** They say it only guarantees delivery, not obedience. They also tell you to skip it if every session runs one model with fixed rules.

**Conditions and risks**
- **Maturity.** It is version 0.1, not on npm, and installed from a git clone. Pin a commit, review the diff before each update, and expect to maintain it.
- **Claude Code version coupling.**
  - It depends on hook behaviors that Claude Code can change, and it was verified on 2.1.328 to 2.1.330 only.
  - It reads an undocumented variable, `CLAUDE_CODE_SESSION_ATTENDED`. If Claude Code renames it, every session would be treated as attended.
  - Pin or stage Claude Code upgrades, and rerun `npm run delivery -- corpus` and `npm run test:live` on each new version.
- **A fresh install gives Opus and Fable nothing in attended sessions.** Their attended preset rules ship off. You would have to write your own rules or use `enable`. For Sonnet and Haiku, most rules need a scope (`NOONSIGHT_SCOPE`) or a code edit before they fire. Set `session.unattended_when_env` for any interactive sessions nobody watches.
- **Known subagent gaps.** A workflow's agents get nothing. Parallel foreground subagent calls of one type that need different rules get nothing until their first edit or write. Plugins noonsight does not read, such as org-synced ones, fall back to the parent's model. `/fork` does not work in `noonsight run` sessions that have rules. Agent teams, routing and the classifier are not measured.
- **Delivery was tested against a stub API.** No real model saw these requests, and the reference answer comes from noonsight's own resolver. A wrong resolution would not show up in the benchmark.
- **Effect on behavior is thinner than delivery.**
  - The evidence is the preset's rules only, on small tasks with 30 to 40 runs per arm, for Sonnet, Haiku and Fable. Opus has none.
  - `verify-changes` made both Sonnet and Haiku run the tests where they otherwise did not (0 of 30 without the rule, 27 to 29 of 30 with it), but it roughly doubled the cost per run on that task ($0.024 to $0.0505 for Sonnet, [R6](docs/evidence.md)).
  - Haiku's `carry-through` showed nothing.
  - Your own rules have no measured effect until you measure them.
- **Account-wide change.** `noonsight install` edits hook settings in every Claude Code login on the machine, so pilot it in a sandbox account or on a few volunteers first.
- **Possible failure modes.** Decisions are logged as delivered when the hook returns, and the log can't see a delivery Claude Code dropped. Four of the nine bugs they found were lost or misattributed deliveries, so watch `noonsight report` against what sessions actually quote.

**What it guarantees:** For the Claude Code versions it was tested on, each session and subagent request carries the rules resolved for its model, scope, place and triggers (and no unretired rules of other models), and this rests on a fuzzed and corpus-checked benchmark against a local stub API that reports 0 violations in 299 completed sessions, not on any proof that the model follows those rules.
