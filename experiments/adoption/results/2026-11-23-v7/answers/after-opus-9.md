**Verdict: adopt with conditions.** Run it as a time-limited pilot on a few machines. Don't roll it out to the whole team yet.

**Reasons**

1. **It solves a problem you have.** Your team mixes models and uses many subagents, which is the case this tool is built for. In its own benchmark, a user `CLAUDE.md` reached only 32.2% of subagent requests (39 of 121). It never reaches the built-in Explore and Plan subagents, and every model also reads the other models' rules. Under noonsight, subagent requests had their rules 100% of the time (668 of 668, then 763 of 763) (`docs/evidence.md` D3, D10, D20).
2. **The testing is unusually thorough.** It fuzzes real Claude Code sessions, keeps a corpus of every bug found (F1–F9), plants faults to check that the fuzzer catches them, and re-checks every published number in `npm test`. The latest run had 0 of 299 sessions break the invariant (D18). The project also lists its own limits.
3. **It's very new.** Everything in the changelog dates from about 14–23 Nov 2026. The version is 0.0.1/0.1, it isn't on npm, and it was renamed from "sextant" during that time. The fuzzer found nine delivery bugs in that time, five of them (F5–F9) in the last run, on paths that had never been tested before. Expect more.
4. **It's tied to specific Claude Code versions.** It was measured only on Claude Code 2.1.328 and 2.1.330. It depends on hook timing and transcript formats it worked out by testing Claude Code itself, and on an undocumented environment variable (`CLAUDE_CODE_SESSION_ATTENDED`) that decides whether a session counts as watched (`docs/verification/claude-code.md`). Any Claude Code upgrade can quietly break delivery.
5. **Out of the box, it does little for your Opus and Fable sessions.** Their preset rules for watched sessions all ship off, so a normal interactive Opus or Fable session gets nothing from the preset. Opus was also left out of the experiments that test whether rules change behaviour, because of cost.
6. **There's no evidence yet that results improve.** The rule effects are from small tasks with 30–40 runs per arm. In the SWE-bench-style pilot, runs cost about 7% more with noonsight on, and the grader saw no measurable difference in outcomes (CHANGELOG, benchmark entry for 2026-11-19).

**Conditions and risks**

Conditions:
- Pin your Claude Code version. Run the delivery corpus (`npm run delivery -- corpus`) before every upgrade, and only upgrade when it passes.
- Declare every model you use in the config. Set `session.unattended_when_env` to the variables your orchestrators and CI set, so sessions nobody watches are treated that way. Give sessions a scope (`NOONSIGHT_SCOPE`); otherwise Sonnet and Haiku get almost nothing either.
- Write your own rules. Treat the preset only as a starting point, and measure whether your rules change anything with `noonsight report` and your own A/B runs.
- Keep rules that every model should always follow in `CLAUDE.md`. Put anything that must never happen in a hook or permission rule; a delivered rule is only context.
- Check that hooks can run where you are. Managed settings can turn user hooks off, and `noonsight check` will tell you.

Risks:
- **Gaps in subagent coverage.** A workflow's agents get no rules. Plugins that noonsight doesn't read, such as ones an organization syncs, leave their subagents with the parent model's rules. Agent teams, routing and the classifier were never measured.
- **Silent loss after an upgrade.** The decision log records what the hook returned, not what reached the model, so a delivery Claude Code drops can still look delivered.
- **Wide install footprint.** `noonsight install` writes hooks into every Claude Code login on the account. Each hook run takes about 50–150 ms of CPU time. `/fork` doesn't work in sessions started with `noonsight run`.
- **A single maintainer moving fast,** with changes that alter behaviour on upgrade. For example, headless runs recently became "unattended" by default. Use `on_preset_change: "hold"`.

**What it guarantees:** Nothing formally: it claims only that each request carries the rules you set for its model, not that the model follows them. That claim rests on a fuzz benchmark against a stand-in API (no real model ever answered), on Claude Code 2.1.328 and 2.1.330 only, scored against noonsight's own rule resolver, so a wrongly resolved rule wouldn't show up.
