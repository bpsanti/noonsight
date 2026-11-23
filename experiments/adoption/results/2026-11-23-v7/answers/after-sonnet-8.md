**Verdict:** Adopt with conditions. Run it as a time-boxed pilot on a few machines, not as a team-wide default.

I read the README, `docs/evidence.md`, `docs/verification/claude-code.md`, and parts of `docs/usage.md` and `docs/hooks.md`. I did not run `npm test` or the benchmarks, so every number below is the project's own claim and is unreproduced.

**Reasons:**
- **It addresses a real gap for a mixed-model team.** `CLAUDE.md` is the same for every model and, per the README, never reaches the built-in Explore and Plan subagents. noonsight gives each session and subagent only the rules for the model it runs on, and gives them again after `/model`.
- **Its delivery numbers are strong and honestly scoped.**
  - Run on Claude Code 2.1.330, 100% (3,090 of 3,090) of requests with rules due held them, including 100% (763 of 763) of subagent requests (D19, D20).
  - A `CLAUDE.md` reached only 32.2% of subagent requests (D10).
  - The project reports its own failures: nine bugs found by fuzzing, F1 to F9, with reproductions and before-fix runs that fail.
- **The design is low-risk.**
  - The hooks never block anything and never use the network, apart from an optional classifier that is off by default.
  - There are no runtime dependencies, and the license is MIT.
  - `noonsight uninstall` and `NOONSIGHT_DISABLE=1` provide an exit.
  - Each decision is logged, so `noonsight report` and `noonsight resolve` let you audit what each model received.
- **The docs say when not to use it.** One case is a single model with fixed rules, where `CLAUDE.md` is simpler. Another is any rule that must never be broken, since delivered rules are context and not enforcement.
- **Rule effects are measured but narrow.**
  - `verify-changes` took Sonnet's test runs on a one-file fix from 0 of 30 to 29 of 30 (R1, R3).
  - It also roughly doubled the cost per run, from $0.0240 to $0.0505 (R6).
  - Where models already did the work, the rules changed nothing and still cost a little.

**Conditions and risks:**
- **The delivery benchmark used a stub API.** It tested which text reached each request, never what a real model did with it. Treat "100% delivery" as plumbing, not as behavior change.
- **Rule effects come from small tasks.** The samples were 30 to 40 runs per arm on tiny tasks, and Haiku's `carry-through` showed no effect. Measure your own rules and drop the ones that change nothing you can see.
- **It is tied to one Claude Code version at a time.**
  - It relies on hook behavior verified on 2.1.325 to 2.1.330, and on an undocumented variable, `CLAUDE_CODE_SESSION_ATTENDED`. If that variable is dropped, every session is treated as attended.
  - It also parses the parent process's `--model` argument with `ps`.
  - Pin your Claude Code version, rerun `npm run test:live` on each upgrade, and expect breakage.
- **Several documented gaps touch your usage.**
  - A workflow's agents get no rules.
  - Agent teams, routing and the classifier are unmeasured.
  - A plugin that noonsight doesn't read, such as one an organization syncs, makes its subagents be predicted on the parent's model.
  - A resumed conversation with an unknown model runs on the default model, which noonsight cannot tell.
  - `/fork` is unavailable in sessions started with `noonsight run` that have rules.
- **Out of the box, Opus and Fable sessions someone is watching get nothing from the preset.** Their attended rules ship off. To get rules there, you must `enable` them or write your own. Sonnet and Haiku need a scope or a code edit to trigger most rules. Set `session.unattended_when_env` for any interactive sessions that nobody is watching.
- **Maturity.**
  - Version 0.1 is not on npm. It installs from a clone, and I could not see the project's history or maintainers since this directory isn't a git repository.
  - It was renamed from "sextant".
  - It writes hooks into every Claude Code login on the account.
  - Check `noonsight check` against any managed-settings policy.
- **Trust boundary.** Per-repository rules do nothing until each person runs `noonsight trust` in that repository. Review committed `.noonsight/` rules like code, because they inject text into every session.
- **Pilot plan.** Install on 2 to 3 machines for a few weeks. Review `noonsight report`, and compare cost on your own tasks. Ship only the rules whose effect you can see.

**What it guarantees:** On the measured Claude Code version (2.1.330, with delivery also benchmarked on 2.1.328), each session and subagent request carries its model's rules and no other model's unretired rules, on 100% of 3,090 requests; this rests on Claude Code's own hooks and a fuzz test of 299 random sessions run against a stub API, not on any measured effect on model behavior.
