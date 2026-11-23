Verdict: **adopt with conditions.** I'd run it as a time-boxed pilot first. I read the README, the evidence map, the Claude Code facts page and the delivery benchmark's failure list. I did not run the test suite or audit the source, so every number below is the project's own.

**Reasons**
- **It fits a mixed-model team.** It delivers rules chosen by the model a session or subagent actually runs on, and it re-delivers them when `/model` changes. A `CLAUDE.md` can't do that. In the author's benchmark, a `CLAUDE.md` reached only 32.2% of subagent requests (39 of 121), `.claude/rules` the same, and skills 0 of 121 (D10, D11).
- **The delivery claim is tested hard.** Random sessions mixed `/model`, `/compact`, `/clear`, resumes, forks, plan mode and subagents against a local stand-in for the API.
  - Under noonsight, 3,090 of 3,090 requests with rules due held them (D19).
  - The latest run found 0 of 299 completed sessions breaking the invariant (D18). One session of the 300 stopped on a turn that got no answer and is not measured.
  - The author keeps shortest-reproduction corpus entries for each failure found (33 of 33 pass, D23).
- **The evidence is traceable and the author is candid.** Each number links to a raw result file, and `npm test` recomputes it. The fuzzer found nine real bugs, F1 to F9, and they are all documented. The README lists its limits plainly.
- **It is low-risk to try.** The hooks never block anything and use no network, apart from the optional classifier, which is off. `NOONSIGHT_DISABLE=1` turns it off for a session. `noonsight uninstall` removes the hooks. It has no runtime dependencies and an MIT licence.
- **Some rules measurably change behavior.** `verify-changes` took Sonnet 5.5 and Haiku 5.5 from 0 of 30 test runs to 29 of 30 and 27 of 30 (R1, R3). `sonnet-5-5/carry-through` raised complete runs on a 13-ticket backlog from 9 of 40 to 32 of 40 (R10). The README says these are small tasks, so don't generalize.

**Conditions and risks**
- **Out of the box, many of your sessions get nothing.**
  - Opus 5.5's and Fable 5.2's attended-session rules all ship off, so an attended Opus or Fable session receives nothing from the preset until you `enable` a rule.
  - Sonnet and Haiku attended sessions get `verify-changes` only after a tracked code edit, and their other rules only with a scope.
  - You would need to write your own rules or enable preset ones for Opus and Fable.
  - You would also need to set `session.unattended_when_env` for interactive sessions nobody is watching.
- **Delivery is not obedience.** A rule is context. Rule effects were measured only for the preset's rules, on Fable 5.2, Sonnet 5.5 and Haiku 5.5, with 30 to 40 runs per arm on small tasks. Opus 5.5 was not measured. Haiku's `carry-through` showed no effect (R11). Rules also cost tokens: Sonnet's fix cost $0.0240 without rules and $0.0505 with `verify-changes` alone (R6).
- **It is coupled to Claude Code internals.** It relies on undocumented behavior, such as `CLAUDE_CODE_SESSION_ATTENDED`, the transcript layout and hook ordering. Each fact was checked on a specific version, mostly 2.1.325 to 2.1.330. Pin your Claude Code version, rerun `npm run test:live` on every upgrade, and expect breakage when Claude Code changes how hooks behave. A silent failure would leave sessions without their rules or with the wrong model's rules.
- **It is immature.**
  - It is version 0.0.1 and not on npm, so you install from a clone with `npm link`.
  - It looks like a single-author project and is days old; the results are dated 2026-11-16 to 2026-11-23.
  - Check the maintainers' plans before depending on it.
- **Known gaps.**
  - Agent teams, routing and the classifier are not measured.
  - A workflow's agents get nothing.
  - Some foreground subagents get nothing until their first edit or agent call.
  - Plugins it doesn't read leave their subagents predicted on the parent's model.
  - A conversation compacted and resumed with nothing naming a model runs on the default model, which it can't detect.
  - `/fork` doesn't work in sessions started with `noonsight run` that carry rules.
- **Its checks are self-referential.** The benchmark's reference is noonsight's own resolver, so a wrong resolution would not show up there. Its hooks run in every session, and the 50 to 90 ms per-hook CPU time (D15) is small but not zero.
- **Pilot plan.**
  - Install on a few machines for two weeks.
  - Write your own Opus and Fable rules.
  - Check `noonsight report` for rules that are on but never delivered.
  - Drop rules that don't change anything you can see.
  - If every session runs one model with fixed rules, the README itself says to use a `CLAUDE.md` instead.

**What it guarantees**
It guarantees that each session and subagent gets the rules written for its own model, and that other models' rules are retired, on the Claude Code versions it was tested against. That rests on hooks that choose rules by model, scope, place and trigger and never by text, and on a fuzzed benchmark of real sessions run against a stand-in for the API. It does not guarantee that the model follows the rules.
