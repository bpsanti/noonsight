**Verdict:** Adopt with conditions. Pilot it on a few machines first, and pin the team to the Claude Code versions it was measured on.

**Reasons:**
- **Subagent coverage is the main gain.** Your team starts many subagents. In the repo's benchmark, subagent requests held their model's rules 100% of the time (668 of 668; D3, and 763 of 763 in the later run, D20). A user `CLAUDE.md` covered 32.2% (39 of 121) and `.claude/rules` 32.2% (D10). Skills covered 0 of 121 (D11).
- **Per-model rules fit your mix.** It ships a preset for Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5, with sources, and lets you add rules per model, per scope, per place, or per repository. A `CLAUDE.md` gives every model the same text. Under noonsight, 79.0% of a request's rule text was written for its own model; with a `CLAUDE.md` it was 31.5% (D12).
- **Delivery is checkable.** Every delivery is logged, and `noonsight report` and `noonsight resolve` show what each model receives before any session runs.
- **Hooks are light and offline.** Each hook run takes about 50–90 ms of CPU, and the hooks never use the network. The exception is the classifier, which is off by default (D15; README).
- **The preset's effects are mixed, not uniformly positive.** `verify-changes` made Sonnet and Haiku run tests after a one-file fix in 29/30 and 27/30 runs, against 0/30 without it (R3, R1). But on Sonnet that fix cost $0.0505 a run with the rule and $0.0240 without it (R6).

**Conditions and risks:**
- **Measured versions only.** The evidence covers Claude Code 2.1.328 and 2.1.330, and the newest run is from 2026-11-23. Hooks behave differently across Claude Code versions, so check your version against those before rollout.
- **Delivery is not obedience.** The benchmark measures that rules reach the model. It does not measure whether the model follows them. The repo's own effect data covers only the preset's rules, on small tasks with 30–40 runs per arm.
- **The benchmark used a stand-in API.** No request reached a real model. Real-session behaviour is therefore only inferred from the hook logs, not measured end to end.
- **Known gaps you will hit:**
  - Attended Opus 5.5 and Fable 5.2 sessions receive no preset rules until you enable them.
  - Workflow subagents get nothing.
  - A plugin your org syncs leaves its subagents predicted on the parent's model.
  - Agent teams, routing and the classifier are not measured.
  - `/fork` is unavailable in sessions started with `noonsight run` and rules.
- **Set the unattended variable.** Interactive sessions nobody watches count as attended unless you set `session.unattended_when_env` to your CI or orchestrator variable.
- **Global install.** `noonsight install` adds hooks to every Claude Code login on the account. Get the team's agreement before running it on shared machines.
- **Install from source.** Version 0.1 is not on npm yet, so each person installs from a clone. Pin the commit and review it before running `npm link`.
- **Repository rules need trust.** Each person must run `noonsight trust` in a repo before its `.noonsight` config takes effect.
- **Watch the cost.** Verify-style rules roughly doubled per-run cost in the repo's Sonnet test. Keep only the rules your own runs show as worth their price.
- **Pilot plan.** Install on two or three machines. Run `noonsight check`, `noonsight models`, and `noonsight resolve` for each model. Use `noonsight report` after a week to confirm rules are delivered. Run `npm test` in your own environment. Then decide whether to roll out.

**What it guarantees:** On the measured Claude Code versions, every session and subagent request receives the rules noonsight resolves for its model, scope, place and trigger, and no other model's rules remain unretired, on 99.9% of due requests in the first run and 100% of subagent requests (D2, D3); this rests on hooks that log each delivery and a benchmark run against a local stand-in API, not on the model's actual compliance or on Claude Code versions beyond those tested.

*Scope of this review:* I read the README, `docs/evidence.md`, and the file layout. I did not run the test suite or open the raw result files, so the numbers above are the repo's own reported figures, not my independent check. `docs/evidence.test.ts` is the place to verify them.
