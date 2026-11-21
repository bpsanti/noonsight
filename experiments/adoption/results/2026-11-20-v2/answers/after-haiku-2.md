**Verdict: Adopt with conditions.** Pilot it on Sonnet and Haiku build and routine sessions first, and don't count on it for Fable or Opus until your own logs show those rules firing.

**Reasons**

- It does the thing you'd want for mixed-model use. It delivers each model's rules at session start, after `/model`, `/compact`, `/clear` and resume, and to subagents. In the 300-session delivery benchmark, 99.5% of requests due rules received them (3,199 of 3,216), and subagent requests were covered at 99.9% (667 of 668) (`docs/evidence.md` D2, D3).
- The native alternatives cover less. Over the same first 60 sequences, a user `CLAUDE.md` covered 87.3% of requests and 32.2% of subagent requests. `.claude/rules` covered 70.9%, and a skill per model covered 0% (`README.md`, D6 to D8, D10, D11).
- It logs what it delivers. `noonsight report` shows which rules fired, for which model, scope and place, and which configured rules never fired. That makes it checkable, which the team can't easily do with `CLAUDE.md`.
- The rule-effect results are real but narrow. On a small one-file fix, Sonnet ran tests after its edit in 30 of 30 runs with rules and 0 of 30 without. Haiku went 27 of 30 against 0 of 30. Those runs cost roughly twice as much on Sonnet ($0.0505 against $0.0240). On Haiku's `carry-through` rule, the long-task result was not significant (6 of 40 against 2 of 40, p = 0.26) (`experiments/rules/results/2026-11-20/summary.md`, `2026-11-20-harder/summary.md`).
- It stays out of the way. Hooks never block and never use the network, and the only exception is the classifier, which is off by default. There are no runtime dependencies (`README.md`).

**Conditions and risks**

- **Fable and Opus were barely measured.** In the rule-effect runs, `fable-5-2/finish-work`, `fable-5-2/low-context-report` and `opus-5-5/unattended-run` were never delivered, so nothing is known about their effect. Set those up and confirm with `noonsight report` that they fire in your real sessions before relying on them.
- **Silent model switches.** The benchmark logged Fable and Opus sessions switching automatically to `claude-opus-4-8` mid-run. noonsight tracks this, but your cost and model accounting may not match what you expect. Check the switch log on your own machines.
- **Scope and place must be set.** A session with no task scope gets almost nothing from the preset. Unattended runs need `session.unattended_when_env` configured. Otherwise the preset delivers little (`docs/usage.md`).
- **Not measured:** `/resume` inside a session, forks, plan mode, agent teams, `noonsight run`, project configurations, and subagents that edit files. Your "many subagents" use is only partly covered by the evidence. The stub API also never let subagents edit files.
- **Version pinning.** Results were measured on Claude Code 2.1.328 and 2.1.329. Hook behavior has changed across versions before, so re-check after each upgrade of the team's Claude Code.
- **Bugs fixed after the big run.** F3 and F4 were found by the 300-session run and fixed after it. Their minimal reproductions pass, but the 300 sessions were not re-run, so the 99.5% figure describes the build before those fixes.
- **Shared install.** `noonsight install` writes hooks to every Claude Code login on the account and changes settings there. Install per user or per machine, and don't commit it to a shared config without agreeing that first.
- **Not on npm.** Version 0.1 is not published, so each person installs from a clone. Pin a commit so everyone runs the same build.
- **Delivery is not obedience.** A delivered rule is context, and the model may still ignore it. The effect data above is the only evidence on that, and it covers small tasks.
- **Cost.** Some rules add cost per run (the `verify-changes` Sonnet example above). Watch `noonsight report` and `docs/usage.md#what-a-rule-costs` for the rules you turn on.

**What it guarantees:** For a session or subagent on the four supported models, it delivers that model's rules and retires any other model's rules, on 99.5% of requests due rules in a benchmark (on Claude Code 2.1.328, before the F3 and F4 fixes). That rests on the hooks Claude Code calls, the resolver's rules, and a decision log that records each delivery. The benchmark used a local stand-in for the API, so no request reached a model. It does not guarantee the model follows the rules.

I did not run the test suite. This verdict rests on reading the README, the experiment summaries, and the evidence page.
