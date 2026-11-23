**Verdict: adopt with conditions.** Run it as a pilot on one Claude Code version before rolling it out to the whole team.

I read the README, `experiments/delivery/README.md`, and the evidence index. I did not read the hook source, run the test suite, or re-run the benchmark, so everything below is from the author's docs and results.

**Reasons**

1. **It addresses a gap you would otherwise have.** The author's own numbers show that `CLAUDE.md` reached 32.2% (39 of 121) of subagent requests, and `.claude/rules` reached the same share. Your team starts many subagents, so the native options miss most of that work. Their numbers show noonsight at 100% for both requests and subagent requests, but those come from their own harness.
2. **It fits your mix of models.** It has per-model rules for Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5, and it re-delivers rules when `/model`, `/compact`, `/clear`, resume or fork changes the model.
3. **It is fail-open and local.** The README says hooks never block anything and never use the network, except the classifier, which is off by default. `NOONSIGHT_DISABLE=1` turns it off for one session.
4. **The delivery claim is checkable.** Every session's deliveries go to a decision log, and `noonsight report` and `noonsight resolve` show what a model would receive. That lets you audit it rather than trust it.
5. **The failure history is disclosed.** The fuzzer found nine failures (F1 to F9), all listed as fixed. One documented limit remains (a conversation compacted and then resumed with no model named runs on the default model). The fixes for F5 to F9 were measured on Claude Code 2.1.330, and the run is dated today, 2026-11-23.

**Conditions and risks**

- **Pin one Claude Code version and re-test on upgrade.** The author says hook behavior changes between Claude Code versions, and the benchmark covers only the versions it names (2.1.325 to 2.1.330). If your team runs a different version, the evidence does not cover you. Re-run `noonsight check` and the delivery corpus after each upgrade.
- **Evidence is delivery only, measured against a stub API.** The 300-session result shows the text reached the request. It does not show that the model followed the rules. Only three models were tested for rule effect, in small runs of 30 to 40 per arm: Fable 5.2, Sonnet 5.5 and Haiku 5.5. Opus 5.5 has no measured rule effect. Measure the rules you care about on your own tasks before counting on them.
- **The reference is the author's own resolver.** The benchmark checks delivery against noonsight's resolver, so a wrong rule mapping would not show up in it. Use `noonsight resolve` and `noonsight models` to review what each model gets.
- **Most preset rules are off for attended sessions on Opus and Fable.** The Opus and Fable attended rules ship off. Anyone who expects them on will be surprised. Decide which to `enable`, and set `session.unattended_when_env` to your CI or orchestrator variable, or interactive sessions nobody watches get treated as attended.
- **Known gaps.** Not measured: agent teams, routing and the classifier. Not covered: a workflow's agents, plugin-supplied subagents that noonsight does not read, and several parallel calls of one agent type that need different rules. Do not rely on noonsight alone for those.
- **Machine-wide install.** `noonsight install` writes `~/.config/noonsight/` and adds hooks to every Claude Code login on the account. Each developer has to install it. Repo rules under `.noonsight/` take effect only after each clone runs `noonsight trust`.
- **Not on npm.** Version 0.1 is not published, so install from a clone with `npm link`. Pin the commit.
- **Cost and latency.** Rules add tokens to each request, and some rules add work (the `verify-changes` rule roughly doubled Sonnet's cost on one task in their test). The hooks run on every tool call, so watch for slowdowns; the author measured hook time but I did not read those numbers.
- **Opt-in classifier sends data out.** When turned on, it sends the first 4,000 characters of a task to a small model through your own login. Leave it off unless your policy allows that.

**Pilot plan I'd recommend:** two or three people, one pinned Claude Code version, the preset with `noonsight resolve` reviewed for each model, and the unattended variable set for CI. After two weeks, use `noonsight report` to confirm delivery, and measure whether any of your own rules change outcomes on your tasks before you widen adoption.

**What it guarantees:** Each session and subagent receives the rules written for its own model, and other models' rules are retired, on every request the author's benchmark measured (0 of 300 sessions broke the invariant on Claude Code 2.1.330, after fixes). That rests on the author's stub-based benchmark, on their resolver as the reference, and on hook behavior they checked on specific Claude Code versions. It does not guarantee that the model follows the rules.
