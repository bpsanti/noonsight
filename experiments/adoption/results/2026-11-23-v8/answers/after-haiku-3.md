**Verdict:** Adopt with conditions. Start with a pilot on Sonnet and Haiku subagent work, not a team-wide rollout.

**Reasons:**
- **Delivery works in the tested setup.** Under the harness, all 3,090 requests with rules due received them, including 763 of 763 subagent requests, across 299 completed sessions with zero invariant breaks (`experiments/delivery`, entries D18 to D22 in `docs/evidence.md`). CLAUDE.md alone covered 46.9% of subagent requests and per-model skills covered 0% (D25 to D29). Subagents are the strongest case for this tool.
- **The effect is real but narrow.** On a one-file fix, Sonnet ran tests after its last edit 30 of 30 times with rules and 0 of 30 without; Haiku went 27 of 30 vs 0 of 30 (R14). On a bug known only by its symptom, Sonnet went 30 of 30 vs 11 of 30 (R15). These are single-task results.
- **No measured quality gain on the broad benchmark.** The pilot resolved 133 of 144 runs with no rules, 132 of 144 with noonsight, and 133 of 144 with a single CLAUDE.md (B1, `experiments/benchmark/results/2026-11-19/summary.md`). The open-answer judge scores are marked uncalibrated.
- **Cost rises.** Mean cost per run went from $0.141 to $0.151 overall (B2). Sonnet rose about 18% ($0.071 to $0.084) and Haiku about 26% more input tokens. On the fix task, Sonnet went from $0.024 to $0.038 per run with its rules (R6).
- **Opus and Fable get little by default.** Per the install doc (`docs/install.md`, step 3), an attended Opus or Fable session receives nothing with the preset. The only Fable rule measurement covers writing style, words per sentence (R9), not task outcomes. No Opus rule-effect run appears in the evidence.
- **It is pre-release.** Installation is from a clone until version 0.1 is published. The root README that the evidence page links to is not in this directory.

**Conditions and risks:**
- **Pin Claude Code.** Every current measurement is for Claude Code 2.1.329 or 2.1.330, and the hook fixtures cover 2.1.325 to 2.1.330. Upgrading can invalidate the results, so pin a tested version and re-run `noonsight check` after each upgrade.
- **Decide Opus and Fable explicitly.** Either enable their rules by configuration with your own evidence, or accept that those sessions get no benefit.
- **Measure cost on your own workload.** Run the pilot on Sonnet and Haiku subagent tasks, compare cost and test-after-edit rates against a control, and expand only if the gain holds.
- **Review the hooks.** They run on every `Agent` tool call and on every `Edit` and `Write`, and they write into every Claude Code config directory of the account. Review the code and check that organizations' policies allow user hooks, because `allowManagedHooksOnly` or `disableAllHooks` silently disables them.
- **Know the gaps.** Logins whose organization delivers server-managed settings ignore the managed-machine install. The first `claude -p` on a new login can start without rules. Windows is unsupported. The watcher is off by default and adds a resident process if turned on.
- **Model switches.** After a switch to Haiku, only 55% of the delivered rule text was written for Haiku (`summary.md`, "after-model-switch"). The invariant check reports zero violations under noonsight, so verify this on your own sessions.
- **Not verified by me.** I read the committed results and docs; I did not run the test suite, including `test/evidence.test.ts`, which recomputes the evidence figures, or the tool itself.

**What it guarantees:** On Claude Code 2.1.330, noonsight delivers each model's rules to every session and subagent it starts, and the repository's stand-in-API harness measured zero invariant breaks across 299 completed sessions (D18 to D22). That rests on that harness, which runs real Claude Code sessions against a local stand-in for the Messages API, so it does not show what a real model does with the rules, and it does not guarantee the model follows them (the rule-effect results cover only a few tasks).
