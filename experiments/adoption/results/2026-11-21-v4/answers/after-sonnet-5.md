**Verdict: adopt with conditions.** Adopt it for delivery of per-model rules, including to subagents, once you've worked through the conditions below. Don't adopt it on the expectation that the rules improve Opus or Fable output, because there's no evidence for that.

**Reasons**

- **It fits your setup.** Your team mixes four models and many subagents. A `CLAUDE.md` can't pick rules by model, and it never reaches the built-in Explore and Plan subagents (`docs/usage.md`).
- **Delivery beat the native options in its own benchmark.**
  - On the same 60 session sequences, requests had their model's rules 100% of the time with noonsight, 87.3% with a user `CLAUDE.md` and 70.6% with `.claude/rules` (`docs/evidence.md`, D5–D7).
  - Subagent requests had them 100% of the time, against 32.2% for the other two (D9, D10).
  - A skill per model delivered 0%, though the stand-in API never opens skills, so that row only shows what a skill guarantees on its own.
- **The delivery tests are serious.**
  - There were 300 randomized real Claude Code sessions: `/model`, `/compact`, `/clear`, resumes, subagents and edits.
  - The fuzzer found four real bugs, F1–F4, which are now fixed and covered by regression cases.
  - It also has planted-failure self-checks.
  - `npm test` recomputes every README number from the raw result files.
- **It's honest about its limits.** The 99.9% figure is stated with its limits, and a documented failing session is counted apart rather than hidden.
- **It's low-risk to run.** The hooks never block or deny anything, use no network, and run 50–90 ms of CPU each (D15). A broken config is refused whole with a warning. You can turn it off per session with `NOONSIGHT_DISABLE=1`, or for good with `noonsight uninstall`. Every decision is logged, and `noonsight report` shows what was delivered.
- **The measured effect on behavior is real but narrow.**
  - Sonnet 5.5 and Haiku 5.5 ran the tests after a fix in 29/30 and 27/30 runs with `verify-changes`, against 0/30 with `carry-through` alone (R3).
  - `sonnet-5-5/carry-through` raised complete runs on a 13-ticket backlog with an open decision from 9/40 to 32/40 (R10).
  - Fable's report style shifted (R9).
  - These are small tasks with 30–40 runs per arm, and the README says to read them that way.
  - The same rules cost about twice as much on a cheap task: $0.024 to $0.0505 per Sonnet run (R6).

**Conditions and risks**

- **It's not on npm yet.** You'd install it from a clone (`npm install && npm run build && npm link`), version 0.1 with no runtime dependencies. Pin a commit and review the code yourselves, since it installs hooks into every login.
- **Claude Code version drift is the biggest risk.** Everything was verified on Claude Code 2.1.328, and some behavior depends on undocumented details, such as `CLAUDE_CODE_SESSION_ATTENDED=0`. Nothing says what happens when the hook-handling behavior changes, so you'd have to re-run the corpus (`npm run delivery -- corpus`) on each Claude Code upgrade and watch `noonsight check`. A missed delivery is silent unless you look at the report.
- **Out of the box, Opus and Fable sessions get almost nothing.**
  - Every preset rule that ships on for them is for unattended runs or subagents, so a watched interactive session on either gets no rules.
  - Sonnet and Haiku get only `verify-changes`, after a tracked code edit, unless the session has a scope.
  - You'd need to set `session.unattended_when_env` for your orchestrator or CI, give sessions a scope via `NOONSIGHT_SCOPE`, and declare every model you use. An undeclared model gets a warning and no rules.
- **Check the preset against your own tasks.** There's no measured effect for Opus rules (left out for cost) or for Haiku's `carry-through` (6/40 against 2/40, no clear gain). The tests found no outcome difference between conditions. Measure with `noonsight report` and your own runs, and drop rules that change nothing, since each costs tokens.
- **Some paths were never tested.** The benchmark did not cover `/resume` inside a session, forks, plan mode, agent teams, `noonsight run`, routing, the classifier, project configs, or subagents that edit files. If you rely on repo-level `.noonsight` files, subagent routing or the classifier, test those yourselves. Note that the classifier sends task text to a model, which is the one place the tool uses the network.
- **Known gaps in prediction.**
  - Plugin subagents, `--agents` definitions and agent-team teammates aren't read, so their rules can be wrong or missing.
  - When several same-type agent calls would get different rules, their subagents get none.
  - A compacted conversation resumed with no model named runs on the default model, which the tool can't see.
  - A subagent that starts on a different model than predicted can only be warned about, after the fact.
- **Rule text can still be ignored.** A delivered rule is context, not enforcement. Anything that must never happen needs a hook or a permission rule.
- **Your team should check which pieces of the tool they actually need.** If a rule is identical for every model and only main sessions need it, a `CLAUDE.md` already delivered 100% (526 of 526) in the benchmark. Use noonsight only for what differs by model, scope or place.
- **A pilot first.** Roll it out to a few people for a couple of weeks and review `noonsight report` for rules that are never delivered, warnings and `MISMATCH` results.

**What it guarantees:** It guarantees that each session and subagent gets the rules for its own model, and that rules for other models are retired by a note, with 99.9% of requests with rules due meeting that in one benchmark of 300 random sessions. That result rests on Claude Code 2.1.328 running against a local stand-in for the API, checked by an oracle that is noonsight's own resolver, so it is an empirical measurement for that one version, not a proof, and it says nothing about what the models do with the rules.
