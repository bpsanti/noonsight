**Verdict:** adopt with conditions, as a time-boxed pilot on a few machines, not a team-wide rollout yet.

I read the README, the docs, and the experiment results. I did not run the test suite or the benchmarks, so the numbers below are the repository's own.

**Reasons:**

- **It fits your setup.** It delivers per-model rules to sessions and subagents, and re-delivers on `/model`, `/compact`, `/clear`, resume and fork. Its own README says a `CLAUDE.md` is simpler when every session runs one model.
- **Subagents are where it beats the native options.** On the same 60 sequences, subagent requests held their rules 100% under noonsight versus 32.2% (39 of 121) for `CLAUDE.md`. `CLAUDE.md` never reaches the built-in Explore and Plan subagents.
- **The delivery evidence is strong but narrow.** The latest run had 0 of 300 fuzzed sessions break the invariant and 3,090 of 3,090 requests covered, on Claude Code 2.1.330. It ran against a local API stub, with the preset's rules, and the reference is noonsight's own resolver.
- **Evidence that it improves work is weak.** In its own 588-run paid pilot, tasks resolved were 133 of 144 without it and 132 of 144 with it, at about 7% more cost per run. The README does not cite this result.
- **Measured rule effects are small-task effects.** `verify-changes` made Sonnet and Haiku run tests in 29 and 27 of 30 runs versus 0 of 30, at roughly double the cost on that task. Haiku's `carry-through` showed nothing.
- **Out of the box it does little for Opus and Fable.** Their attended-session preset rules all ship off, so interactive sessions on either get nothing until you enable rules or write your own.
- **It is very young.** Version 0.0.1, not on npm, one author, renamed once, and nine delivery bugs found and fixed in the past week. Two of those were found by this morning's run.
- **It is low-risk to try.** No runtime dependencies, hooks always exit 0 and never block, no network use with the classifier off, and `noonsight uninstall` removes its entries.

**Conditions and risks:**

- **You need rules that differ by model.** If your rules are the same for every model, the gain shrinks to subagent coverage and may not justify the tool.
- **Pin Claude Code and re-verify on each upgrade.** It depends on undocumented behaviour (`CLAUDE_CODE_SESSION_ATTENDED`, transcript layout, fork metadata). CI pins 2.1.325 while results are from 2.1.328 and 2.1.330; run the corpus before each upgrade.
- **Pin a commit and review it.** There is no published release; each person builds from a clone, and the hook pointer breaks if that clone or Node moves.
- **Check your organization's settings.** `allowManagedHooksOnly` or `disableAllHooks` in managed settings stops the per-account install, and server-managed settings make Claude Code ignore the machine-wide install.
- **Known subagent gaps apply to you.** Workflow agents get nothing, and organization-synced plugin agents are predicted on the parent's model. Parallel same-type calls needing different rules get nothing until each subagent's first Edit, Write or agent call. Split-pane agent teams, routing and the classifier are unmeasured.
- **Automatic model fallback leaves sessions without rules.** In the pilot, Claude Code switched Fable and Opus to Opus 4.8 and Sonnet 5.5 to Sonnet 5 on one task. The preset has no rules for those models, so the session gets only the retirement note.
- **Per-person setup is required.** Each person runs `noonsight install`, and `noonsight trust` once per repository with a committed configuration. Windows is not supported for the machine-wide install and unverified otherwise.
- **Expect some overhead.** Each hook run costs 50 to 90 ms of CPU, and each rule adds tokens. A local decision log records session ids and edited file paths.
- **Measure before expanding.** Check `noonsight report` after two weeks and compare one outcome you care about with and without it, since the repository does not show an outcome gain.

**What it guarantees:** On the Claude Code version it was measured on, each session and subagent request carries the rules configured for the model it runs on, outside the documented limits. That rests on stubbed-API fuzz runs checked against its own resolver and on undocumented Claude Code hook behaviour, and it guarantees delivery of text, not that the model follows it.
