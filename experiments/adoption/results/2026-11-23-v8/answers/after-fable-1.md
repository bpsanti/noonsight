**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines, pinned to one commit, and do not roll it out team-wide yet.

I read the README, the evidence map, the hook contract, the delivery and pilot result files, the preset and CI config. I did not run anything: there is no built `dist/` and I have no shell here, so the test suite is unverified by me.

**Reasons**

- **It targets your situation.** It delivers rules per model to sessions and subagents. The alternative of one `CLAUDE.md` holding every model's rules reached 46.9% of subagent requests (60 of 128) in its own benchmark, and never reaches the built-in Explore and Plan subagents.
- **The delivery numbers match the raw summary.** `summary.json` for the current run shows 299 of 300 sessions completed, 3,090 of 3,090 requests with rules due held them, 763 of 763 for subagents, and zero violations.
- **It is unusually honest about its limits.** Nine delivery failures (F1 to F9) are documented with reproductions, and the README lists what is not measured.
- **Its footprint is small and local.** It has no runtime dependencies; the hooks always exit 0 and never deny a call. A grep of `src/` found no network code, and child processes only for `git`, `ps`, `claude` and the watcher service.
- **No benefit to task outcomes is shown.** The paid pilot resolved 133, 132 and 133 of 144 tasks without rules, with noonsight and with a `CLAUDE.md`, and noonsight cost about 7% more per run than no rules.
- **The preset gives your Opus and Fable interactive sessions nothing by default.** All their attended rules ship off, so the value for you depends on rules you write or enable yourselves.
- **It is very young.** The package is version 0.0.1, marked private and not on npm, with one author. The earliest run is dated 2026-11-16, and all nine failures were found and fixed in the last few days.

**Conditions and risks**

- **Claude Code version:** the claim holds on 2.1.330 only, and the results span five versions (2.1.326 to 2.1.330) in a week. Pin Claude Code during the pilot and rerun `npm run delivery -- corpus` before each upgrade; it needs no login and spends no tokens.
- **Undocumented behaviour:** fork detection, headless detection and the subagent metadata lookup rely on Claude Code internals the docs say are undocumented. A Claude Code update can break delivery silently.
- **Install scope:** use the per-account install, not `--managed`, which a user's `disableAllHooks` cannot turn off. Windows is not supported for the machine-wide install, and the hook is a POSIX shell script.
- **Supply chain:** you install from a clone of a personal GitHub repo, and the hook runs in every session with each developer's privileges. Pin a reviewed commit.
- **Gaps that may hit you:**
  - Agent teams, routing and the classifier are unmeasured.
  - Workflow agents get nothing.
  - Subagents from organisation-synced plugins are predicted on the parent's model.
  - Parallel same-type subagent calls needing different rules get nothing until their first edit or agent call.
- **Fallback models:** in the pilot Claude Code switched on its own to Opus 4.8 and Sonnet 5, which the preset does not cover. Those sessions got only a note that the earlier rules no longer apply.
- **Cost:**
  - Each of the seven hooks starts a Node process, at 80 to 150 ms of CPU, on every edit and agent call.
  - `verify-changes`, on by default for Sonnet and Haiku, roughly doubled the cost of a small fix.
  - Only 48.5% of the text noonsight adds is a first copy of a rule that applies; the rest is repeats, retired rules and wrappers.
- **Benchmark strength:**
  - "Rules due" is defined by noonsight's own resolver, so a wrong resolution would not show.
  - It is one seed, on one macOS laptop, against a stub API.
  - The per-session files are not committed.
  - In the self-check, two of three planted bugs were caught in only 4 of 9 and 7 of 15 exposed sessions.
- **Per-person setup:** each developer must run `noonsight install`, and `noonsight trust` once per repository, or the repository's rules silently do nothing.
- **Exit test:** after the pilot, keep it only if `noonsight report` shows your own rules arriving and you can see a behaviour change you want. Delivery alone is not a reason.

**What it guarantees**

It guarantees nothing contractually; it reports that on Claude Code 2.1.330 every measured request carried the rules its own resolver assigned to that model (delivery, not obedience), and that rests on Claude Code's hook behaviour staying as it was on that one version.
