**Verdict: adopt with conditions.** Pilot it on a few machines first. Don't roll it out to the whole team yet.

**Reasons**

- **It fits your setup.** You run four models and many subagents. The tool's one job is to put each model's own rules into every session and subagent request, and to re-deliver them on `/model`, `/compact`, `/clear` and resume. The preset covers Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5 (README, `docs/usage.md`).
- **It beats the native options for mixed-model work.** On the same 60 sequences, a user `CLAUDE.md` covered 87.3% of requests and `.claude/rules` 70.9%. Subagent requests were covered 32.2% of the time by both, against 100% for noonsight (D5–D10). A `CLAUDE.md` never reaches Explore or Plan subagents. It also puts every model's rules in front of every model: only 31.6% of its rule text was written for the model reading it, against 78.8% under noonsight (D12).
- **The delivery claim is carefully measured.** The benchmark ran 300 fuzzed sessions of real Claude Code 2.1.328 against a local stand-in for the API. The oracle is stated in `experiments/delivery/README.md`. The raw results are committed. `npm test` recomputes every README number from them. The fuzzer's failures (F1–F4) are written up with reproductions, and the tool itself is not hidden.
- **The risk surface is small.** The hooks never block anything and never use the network. The exception is the optional classifier, which is off by default. There are no runtime dependencies. `NOONSIGHT_DISABLE=1` and `noonsight uninstall` are the way out, and `noonsight report` shows what was delivered.
- **There is some evidence that the rules change behavior.**
  - Sonnet ran the tests after a one-file fix in 30 of 30 runs with the rules against 0 of 30 without (R1). Haiku went from 0 to 27 of 30.
  - Sonnet's `carry-through` rule raised full completion on a 13-ticket backlog from 9 to 32 of 40 (R10).
  - The authors also report where rules did nothing: Haiku's `carry-through` (R11), and the tasks where models already did the work.

**Conditions and risks**

- **Delivery rate.** The committed 99.5% (3,199 of 3,216 requests) comes from a build that predates the F3 and F4 fixes. The 300 sessions have not been re-run on the fixed build. The three failing sessions are attributed to F3 and F4, and their reproductions pass. Before you rely on it, re-run `npm run delivery -- fuzz --n 300` yourselves. It costs no tokens.
- **Claude Code version coupling.** It relies on hook behavior that Claude Code can change. The facts were checked on versions 2.1.325 to 2.1.329. Pin your Claude Code version, or re-run the corpus and `npm run test:live` on each upgrade.
  - **Resume gap.** There is also a documented gap: a compacted session resumed with nothing naming a model runs on the default model, and noonsight cannot tell which that is.
- **Delivery is not obedience.** Rules are context. If a rule must never be broken, use a hook or a permission rule.
- **Rules are not delivered by default.** A watched session with no scope gets almost nothing from the preset.
  - **What you must set.** Declare every model you run. Set `session.unattended_when_env` for CI and orchestrators. Give tasks a scope with `NOONSIGHT_SCOPE`, patterns or `noonsight run`.
  - **Silent failure.** Without this, adoption looks successful and does nothing. Check with `noonsight report` and `noonsight models`.
- **The behavioral evidence is thin.** It covers small tasks, 30 to 40 runs per arm, mostly Sonnet and Haiku. Fable's only result is shorter sentences in its final reports (R9). Nothing in `docs/evidence.md` shows an Opus effect.
  - **Pilot check.** Pilot on your own tasks and drop any rule that changes nothing you can see.
- **Rules cost tokens and money.** `verify-changes` roughly doubled Sonnet's cost per run on the fix ($0.0240 to $0.0505, R6). Where models already behave as the rule asks, it costs a little and changes nothing.
- **Gaps and immaturity.**
  - **Not measured.** Several paths are untested: `/resume` inside a session, forks, plan mode, agent teams, `noonsight run`, routing and the classifier. Subagents that edit files are untested too.
  - **Maturity.** Version 0.1 is not on npm; you install it from a clone. The README credits a single author, and the project has already been renamed once.
  - **Install scope.** It edits your Claude Code account settings, so test `install` and `uninstall` on one machine first.
- **Drop it if you standardize on one model.** The tool's own docs say a `CLAUDE.md` is simpler when every session runs one model with fixed rules.

**What it guarantees:** Each request to a Claude model, including its subagents' requests, carries that model's own rules, which held on 99.5% of requests in 300 fuzzed sessions of Claude Code 2.1.328. That is measured against a local stand-in for the API, so the benchmark never tested what a real model does with the rules. It also rests on Claude Code's hook behavior staying as it was checked, and it does not guarantee obedience.
