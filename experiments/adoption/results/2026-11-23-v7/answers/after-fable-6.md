**Verdict: adopt with conditions.** Pilot it on a few accounts with rules you write yourselves, pinned to a tested Claude Code version; do not roll it out team-wide on the preset alone.

I only had read access, so I ran nothing: no tests, no install. The numbers below are the repository's own committed results, and I did not review the source beyond a search for network and process calls.

**Reasons**

- **It solves a problem your setup has.** With sessions on four models and many subagents, a shared `CLAUDE.md` reached only 32.2% of subagent requests (39 of 121) in its benchmark and never reaches the built-in Explore and Plan subagents. noonsight reached 100% (763 of 763) in its latest run.
- **It keeps other models' rules out.** Under a `CLAUDE.md`, about 31.5% of the rule text a request carried was written for its model, against 79.0% under noonsight.
- **Delivery is well tested, but only delivery.** In 299 random sessions on Claude Code 2.1.330 (model switches, compaction, resumes, forks, plan mode, subagents), all 3,090 requests with rules due held them. Those sessions ran against a local stand-in for the API, so no model was involved.
- **No measured quality gain.** In its 588 paid runs, tasks resolved were 133 of 144 without rules, 132 with noonsight and 133 with a `CLAUDE.md`. noonsight cost about 7% more per run than no rules, and the `CLAUDE.md` about 19% more.
- **Individual rules can change behaviour, on small tasks.** `verify-changes` made Sonnet run the tests after a fix in 29 of 30 runs against 0 of 30 without it, at roughly double the cost of that run ($0.0505 against $0.0240). Samples are 30 to 40 runs per arm.
- **The preset does little for your attended Opus and Fable sessions.** All their attended-session rules ship off, so those sessions receive nothing until you enable rules or add your own. Sonnet and Haiku attended sessions get `verify-changes` only after editing a tracked code file.
- **It is very young.** `package.json` says version 0.0.1 and private, it is not on npm, it appears to have one author, and every result is dated between 14 and 23 November 2026. Its own fuzzer found nine delivery failures in that time, five of them in the latest round; all are reported fixed.
- **It is low-risk to try.** It has no runtime dependencies, and my search of `src` found no network code. The hooks are documented to always exit 0 and never block a call. `noonsight uninstall` removes its entries, and `NOONSIGHT_DISABLE=1` turns it off for a session.

**Conditions and risks**

- **Pin Claude Code.** It depends on undocumented behaviour (the `CLAUDE_CODE_SESSION_ATTENDED` variable, subagent metadata files, fork transcript fields) checked only on 2.1.325 to 2.1.330. A Claude Code update can break delivery silently, so re-run its live checks before each upgrade.
- **Write your own rules.** The value for you is in rules that differ by model. Keep what every model needs in `CLAUDE.md`, and measure whether each rule changes anything.
- **Plan the rollout per person.** Each person installs from a clone and runs `noonsight trust` once in each repository that carries rules. The hook points at absolute Node.js and clone paths, so moving either stops delivery quietly until `noonsight check` is run.
- **Check your organisation's settings.** If you are on a Team or Enterprise plan with server-managed settings, the machine-wide install is ignored; use the per-account install. If the organisation sets `allowManagedHooksOnly` or `disableAllHooks`, the per-account hooks will not run either.
- **Windows is not supported yet** for the machine-wide install; the hook is a POSIX shell script.
- **Known subagent gaps:**
  - Workflow agents get nothing.
  - Parallel foreground subagents of one type that need different rules get nothing until their first edit or agent call.
  - Subagents from plugins it cannot read are predicted on the parent's model.
  - Agent teams, routing and the classifier are unmeasured.
- **Fallback models have no rules.** In the paid runs Claude Code switched by itself to Opus 4.8 and Sonnet 5 on one task; noonsight then delivers only a note retiring the earlier rules.
- **The benchmark grades itself.** The reference for "correct rules" is noonsight's own resolver, so a wrong resolution would not show.
- **Overhead is small but constant.** It reports 50 to 90 ms of processor time per hook run, and it keeps a decision log and state files in each home directory.

**What it guarantees**

noonsight guarantees that each session and subagent has its model's configured rules placed in its context (not that the model follows them), and that rests on Claude Code's hook behaviour as checked on versions 2.1.325 to 2.1.330 against a stand-in API, with noonsight's own resolver as the reference.
