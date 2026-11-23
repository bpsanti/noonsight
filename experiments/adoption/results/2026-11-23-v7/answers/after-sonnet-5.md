**Verdict: adopt with conditions.** Pilot it on a few people's machines first. Don't roll it out team-wide yet.

**Reasons:**
- **It solves your problem, and the native options measurably don't.** On the same 60 sequences, noonsight put each model's rules on 100% of requests. A user `CLAUDE.md` reached 87.3% and `.claude/rules` 70.6%. Both reached only 32.2% of subagent requests. A per-model skill reached 0% ([D5–D11](docs/evidence.md)). That matters because many of your sessions start subagents and you run mixed models.
- **The delivery evidence is unusually well documented.** Every README number maps to a committed raw file, and `npm test` recomputes it. The fuzzer found nine of the tool's own failures (F1–F9) and they were fixed. The later run on Claude Code 2.1.330 had 0 of 299 sessions breaking the invariant, and coverage was 100% (3,090 of 3,090 requests) ([D18, D19](docs/evidence.md)).
- **The footprint is small.** It has no runtime dependencies, uses no network, and its hooks never block anything. A hook run costs about 50–90 ms of CPU ([D15](docs/evidence.md)). `NOONSIGHT_DISABLE=1` turns it off and `noonsight uninstall` removes it. Without the classifier, nothing leaves your machine.
- **The rule effects are real for some rules.** `verify-changes` took the fraction of runs that ran tests from 0 of 30 to 29 of 30 on Sonnet, and to 27 of 30 on Haiku ([R1, R3](docs/evidence.md)). Sonnet's `carry-through` raised full-backlog completion from 9 of 40 to 32 of 40 ([R10](docs/evidence.md)).
- **It is candid about its limits.** The README lists what it doesn't guarantee, and the claims I checked against the evidence file matched.

**Conditions and risks:**
- **The preset does little for your Opus and Fable sessions out of the box.**
  - All of Opus 5.5's and Fable 5.2's attended rules ship off. They were turned off because of cost or narrow use: `code-ownership` raised output tokens by about 70–80%.
  - Those attended sessions receive nothing until you run `enable` on specific rules.
  - Only headless runs and subagents get the preset rules for those two models.
  - Sonnet and Haiku attended sessions get `verify-changes` once they edit a tracked code file. Their other rules need a scope.
  - So the value for your team depends on rules you write or enable, and you must measure those yourselves. Measured effects exist only for the preset's own rules.
- **Delivery is not obedience.** The benchmark only checked that rule text was present in requests, using a stand-in API, so no request reached a model. Rule effects come from small tasks with 30–40 runs per arm. Rules also cost money: Sonnet's `verify-changes` doubled the cost of a simple fix, from $0.0240 to $0.0505 ([R6](docs/evidence.md)).
- **It is fragile to Claude Code upgrades.**
  - It was verified on specific versions (2.1.325–2.1.330). It relies on undocumented behavior, such as the `CLAUDE_CODE_SESSION_ATTENDED` variable and hook timing, which the verification doc admits.
  - If that variable is renamed, every session is treated as attended.
  - Pin your Claude Code version and rerun `npm run test:live` before upgrading.
  - Another documented limit is that a compacted-then-resumed conversation with nothing naming a model runs on the default model. noonsight can't tell which model that is.
- **Known gaps for subagents.**
  - Workflow agents get nothing.
  - Foreground subagents of one type that need different rules get nothing until their first Edit, Write or agent call.
  - Subagents from plugins it doesn't read, such as org-synced ones, are assumed to run on their parent's model.
  - Agent teams, routing and the classifier were not measured.
  - `/fork` doesn't work in sessions started with `noonsight run`.
- **Maturity is low.**
  - It is version 0.1, not on npm, and installed from a clone.
  - It appears to be one author's project (`bpsanti`).
  - The oracle for "has its rules" is the tool's own resolver, and the author also wrote the fuzzer. You'd be depending on one maintainer keeping pace with Claude Code releases.
  - Setting `session.unattended_when_env` for unattended sessions is on you.
- **Skip it if you only need a few rules shared by every model.** Its own docs say a `CLAUDE.md` is simpler in that case. It earns its place only if you want rules that differ by model, place or task, or if you need to reach subagents.

**What it guarantees:** It guarantees that each session and subagent gets the rules written for the model it is actually running on, and gets them again when the model changes. That rests on Claude Code's hook events, tested with 300 fuzzed sessions on 2.1.328 (99.9% coverage) and 299 on 2.1.330 (100%) against a local stand-in for the API. It does not guarantee that the model follows the rules.
