**Verdict:** Adopt with conditions. Start with a pilot on a few people's sessions, and keep the conditions below.

**Reasons:**
1. It addresses the problem you have. Your team runs four models and many subagents, and noonsight delivers each model's rules to each session and subagent that runs on it. The benchmark measured the native options on the same sessions. A user `CLAUDE.md` covered 88.2% of requests with rules due, and only 46.9% of subagent requests. `.claude/rules` covered 76.3%. A skill per model covered 0%. noonsight covered 100% (3,090 of 3,090 requests, 763 of 763 subagent requests) on Claude Code 2.1.330 (`experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`).
2. The native options also send each model the other models' rules. In the `CLAUDE.md` condition only 32.6% of the rule text a request carried was written for its model. Under noonsight that share was 100% of the rule text in the paid runs (`experiments/benchmark/results/2026-11-19/README.md`).
3. It covers the paths your team hits: model switches with `/model`, `/compact`, `/clear`, resume, fork, plan mode, and subagents that edit files. Each has a row in the delivery results.
4. It is low-risk to run. It reads local files, uses the network only for an optional classifier that is off by default, and its hooks never block anything (`README.md`).
5. The evidence on quality is weak in both directions. On the pilot's SWE-bench and Terminal-Bench tasks, pass counts were 133 (no rules), 132 (noonsight) and 133 (`CLAUDE.md`) of 144, so there was no measurable quality gain. The one rule with a measured effect is `verify-changes` on Sonnet 5.5 and Haiku 5.5. Adopting this buys reliable delivery, not better output.

**Conditions and risks:**
- **Pin the Claude Code version.** Results exist for 2.1.326, 2.1.328 and 2.1.330. Rerun `noonsight check`, the corpus (`npm run delivery -- corpus`) and `noonsight report` after each Claude Code upgrade, because hook behavior has changed between versions.
- **Review what you install.** It is a 0.1.0 package from one author, installed into every Claude Code login through hooks. Read `src/adapters/claude-code/install.ts` and `hook.ts`, and pin the npm version. The benchmarks were run by the author, not by an independent party.
- **Set `session.unattended_when_env`** to your CI or orchestrator variable. Otherwise headless and orchestrated sessions get the attended rules. Most Opus 5.5 and Fable 5.2 attended rules ship off, so decide which ones to `enable`.
- **Use scopes for Sonnet and Haiku.** Their scoped rules deliver nothing in a session without `NOONSIGHT_SCOPE`.
- **Commit repo config carefully.** Each clone must run `noonsight trust` before a repo's `.noonsight/noonsight.json` has any effect.
- **Known gaps.** Agents started by a workflow get no rules. Plugins that noonsight does not read leave their subagents on the parent's model. `/fork` is unavailable under `noonsight run`. Agent teams, routing and the classifier are not measured. A compacted conversation resumed with no model named runs on the default model, which noonsight cannot detect.
- **Cost.** In the pilot, a run cost about 7% more with noonsight (Fable, Opus and Sonnet included), and hook time was 80–150 ms per hook on a loaded machine. Measure this on your own workload.
- **Acceptance test before rollout.** Run `noonsight report` on a sample of your real sessions. It shows what was delivered, not whether the model followed it. Measure rule effects on your own tasks before you rely on a rule.

**What it guarantees:** Through Claude Code's hooks, noonsight puts the rules declared for a model into the requests of each session and subagent that runs on that model, and again after a model change, compaction, clear, resume or fork. This is delivery, not obedience, and it rests on the author's delivery harness, which uses a local stand-in for the Messages API and real interactive Claude Code sessions, run on Claude Code 2.1.330, with the limits listed above.

I read the README, the delivery and benchmark documentation and the result files. I did not install the package, run its test suite, or run any sessions, so these verdicts rest on the documents and the author's reported results.
