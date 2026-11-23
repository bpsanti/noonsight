**Verdict: Adopt with conditions.** Run it as a pilot on one machine or repo group first, pinned to one Claude Code version, before rolling it out to everyone.

**Reasons**

- It solves a problem you have. Per the README, `CLAUDE.md` reached 87.3% of requests and only 32.2% of subagent requests, and `.claude/rules` reached 70.6%. noonsight reached 100% in the same sequences ([README.md](README.md), [docs/evidence.md](docs/evidence.md) D5 to D10). Since your sessions mix Opus, Sonnet, Haiku and Fable and many start subagents, per-model delivery is the case where this tool beats a single `CLAUDE.md`.
- The fix history is documented. The fuzzer found failures F1 to F9, all fixed. The 2.1.330 run (D18, 0 of 300 sessions broken; D21, 453 of 453 requests on the new paths; D22, 1,308 of 1,308 requests in project and `noonsight run` sessions) is recorded in [docs/evidence.md](docs/evidence.md) with its commit and version.
- It stays out of the request path. The hooks never block, make no network calls by default, and read only local files. The one network path is the classifier, which is off unless enabled ([README.md](README.md), "Features").
- Its checks can be rerun. `npm test` recomputes the evidence numbers from the raw result files. `noonsight report` shows what was delivered to which model, scope and place.
- Repo-level rules are gated. A committed `.noonsight/noonsight.json` changes nothing until each person runs `noonsight trust` ([README.md](README.md), "Your own rules").

**Conditions and risks**

- **Pin the Claude Code version.** Every measurement is tied to one version (2.1.328 and 2.1.330 in the evidence). The verification doc records that hook behavior has changed between versions. Pick the version your team uses, check it appears in [docs/verification/claude-code.md](docs/verification/claude-code.md), and don't upgrade Claude Code without rerunning `npm test` and `noonsight report`.
- **Know the subagent limits.** Several foreground agent calls of the same type that need different rules leave their subagents with no rules. Workflow agents get nothing. Plugin-supplied subagents are not read. Your team starts many subagents, so check the `noonsight report` output for subagents that never receive a rule.
- **Set `session.unattended_when_env`.** Interactive sessions nobody watches count as attended unless this is set. Opus 5.5 and Fable 5.2's attended rules ship off, so an attended Opus or Fable session may receive nothing from the preset.
- **Install from a pinned clone.** Version 0.1 is not on npm. Install from a specific commit, not `main`, and review the code first. The hooks run in every Claude Code login on the machine.
- **Review your own rules.** Rule text goes into every matching model's context and is not checked for content. Treat `.noonsight/noonsight.json` in a repo like any other instructions file, and review changes to it.
- **Delivery is not behavior.** The benchmark checks that the right text arrives. It does not show the model follows it. The rule-effect results are for the preset's rules on small tasks with 30 to 40 runs per arm. Measure any rule you add.
- **The benchmark is not a real-model run.** The delivery benchmark used a local stand-in for the API. It was run by the project's own authors, with one seed per run. Your own sessions are the real test.

**Pilot plan (my recommendation):** install from a pinned commit on two or three machines, set the unattended variable, run `noonsight check`, `models` and `report` after a day of normal work, then decide whether to expand.

**What it guarantees:** Under the benchmark's conditions (Claude Code 2.1.330, noonsight at commit c5b9130, a stand-in API), every request of a session or subagent that has due rules receives the rules for its own model, scope, place and triggers, and no other model's rules stay active, in 100% of requests on the post-fix paths measured ([docs/evidence.md](docs/evidence.md) D18, D21); this rests on the project's own benchmark and tests, not on production use with real models, and it guarantees delivery of the text, not that the model follows it.

I did not run the test suite; the above is from reading the README, the evidence and verification docs, and the experiment README.
