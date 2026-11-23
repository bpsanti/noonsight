**Verdict: Adopt with conditions.** Pilot it on the interactive Sonnet and Haiku sessions and on subagents first. Don't count on it for Opus or Fable sessions until you've written your own rules for them.

**Reasons**

- **Coverage is measured for the paths you use most.** In the delivery benchmark (300 sessions on Claude Code 2.1.328), 3,219 of 3,221 requests that had rules due got their model's rules. That includes `/model`, `/compact`, `/clear`, resumes, and subagents, including the built-in Explore and Plan subagents, which a `CLAUDE.md` never reaches (`README.md`, `experiments/delivery/README.md`).
- **It beats the native alternatives on your workload.** On the same sequences, a user `CLAUDE.md` covered 87.3% of requests and 32.2% of subagent requests. `.claude/rules` covered 70.6%, and a skill per model covered 0% (`README.md`, `docs/evidence.md`).
- **It doesn't make things worse on the hooks side.** The hooks never block and never use the network, and there are no runtime dependencies. The only exception is the classifier, which is off by default.
- **The rule-effect data is real but narrow.** `verify-changes` got Sonnet and Haiku to run tests after their last edit in 27–30 of 30 runs, against 0 of 30 with no rule (`experiments/rules/results/2026-11-20/summary.md`). That's 600 real runs, but only on Sonnet and Haiku, with 30 runs per arm, on small tasks.
- **Your Opus and Fable sessions get nothing out of the box.** The preset's Opus and Fable rules are for unattended runs and subagents only, so a watched interactive Opus or Fable session receives nothing in any scope (`README.md`, lines 45–46).

**Conditions and risks**

- **Pin Claude Code.** The hook facts in `docs/verification/claude-code.md` were checked on versions 2.1.325 to 2.1.330. The benchmark ran on 2.1.328. If your team runs a different version, rerun `npm run test:live` before relying on it.
- **Make the Opus and Fable gap explicit.** Either write your own rules for those models with `models.<id>.add`, or accept that those sessions get no delivered rules. Set `session.unattended_when_env` to your orchestrator's variable so CI or orchestrated runs count as unattended.
- **Give Sonnet and Haiku sessions a scope.** Their scoped rules only arrive when a scope is set (`NOONSIGHT_SCOPE`).
- **Keep universal rules in `CLAUDE.md`.** The README recommends this split, and it's the sensible default for a team.
- **Install from a clone, and read it first.** There's no npm release yet (0.1 is a placeholder). `noonsight install` adds hooks to every Claude Code login on the account, so review the code, then install and check with `noonsight models` and `noonsight resolve`.
- **Repository configs are unmeasured.** Each developer must run `noonsight trust`. Until then, a repo's `.noonsight/noonsight.json` changes nothing, and the benchmark did not test that path.
- **File-editing subagents are unmeasured.** Your team starts many subagents, so this matters. The README lists "subagents that edit files" as not measured, along with `/resume` inside a session, forks, plan mode, agent teams, and `noonsight run`.
- **Cost can rise.** On Sonnet's fix task, `verify-changes` roughly doubled cost per run ($0.024 to $0.0505). Check `noonsight report` and watch spend on the models where rules are on.
- **Delivery is not obedience.** A delivered rule is context. The data for the preset's rules shows effects on Sonnet and Haiku only, and they don't transfer to rules you write yourselves until you measure them.

**What it guarantees**

On the tested Claude Code versions and paths, each session and subagent that starts with noonsight installed receives the rules written for its own model (and none for other models), again after a model switch, and the delivery is logged. This rests on the 300-session benchmark run against a local API stand-in on Claude Code 2.1.328, plus hook behavior checked version by version, and it does not extend to the unmeasured paths above or to whether a delivered rule changes what the model does.

*Caveat:* I read the README, the docs, and the result summaries. I didn't run `npm test` or the benchmark, so these numbers are the repo's own claims, not something I reproduced.
