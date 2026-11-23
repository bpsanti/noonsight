**Verdict:** adopt with conditions — as a time-boxed pilot with rules you write yourselves, not as a team-wide rollout yet.

I read the README, evidence map, install and verification docs, and the benchmark and experiment summaries. I could not run the test suite in this session, so every number below is the repository's own claim, not something I reproduced.

**Reasons:**
- **It fits your setup.** It delivers per-model rules to sessions and subagents through Claude Code hooks, and re-delivers them when the model changes. Its own README says to skip it if every session runs one model, which is not your case.
- **It closes a real gap for subagents.** In its benchmark, one `CLAUDE.md` holding every model's rules reached 32.2% of subagent requests (39 of 121) and never reached the built-in Explore and Plan subagents. noonsight reached 100% on the same sequences.
- **It sends less irrelevant text.** Under noonsight 79% of the rule text in a request was written for that request's model, against 31.5% with a `CLAUDE.md`.
- **No better outcomes were shown.** In the 588-run paid pilot, tasks resolved were 133 of 144 without it and 132 of 144 with it, at about 7% more cost per run. The README says plainly that this is not a quality claim.
- **Rule effects are narrow and cost money.** `verify-changes` made Sonnet run tests after a one-file fix in 29 of 30 runs against 0 of 30, but the run cost went from $0.024 to $0.051. All 600 runs passed the hidden check with or without rules.
- **The default preset does little for attended Opus and Fable sessions.** Their attended rules ship off, so those sessions receive nothing until you enable rules or add your own.
- **It is very young.** Version 0.0.1, not on npm (install from a clone), one author, already renamed once, and its earliest recorded check is dated 2026-11-14. Its own fuzzer found nine delivery failures in about a week; all are recorded as fixed, the last ones today.
- **The engineering is careful.** There are no runtime dependencies, the hooks never block and never use the network (optional classifier aside), repository rules need a per-person `noonsight trust`, and uninstall is one command.

**Conditions and risks:**
- **Pin Claude Code.** Delivery is measured on 2.1.328 and 2.1.330 only, and it relies on undocumented behaviour (an undocumented environment variable, transcript contents, the parent process's command line). Re-run `noonsight check` and the live tests before each upgrade.
- **Failures are silent.** Hooks always exit 0, so a broken delivery looks like a normal session. The decision log records what the hook returned, not what reached the model; failure F1 was exactly that mismatch.
- **Write and measure your own rules.** The value depends on rules that truly differ by model; keep everything shared in `CLAUDE.md`.
- **Check your organisation's settings.** Managed settings with `allowManagedHooksOnly` or `disableAllHooks` stop it entirely, and server-managed settings make the machine-wide install ignored. Each person must run `noonsight install` themselves.
- **Know the uncovered paths.** Agent teams, routing, the classifier and `opusplan` are unmeasured; workflow agents get nothing; subagents from organisation-synced plugins may be predicted on the wrong model. Windows is not supported for the machine-wide install and its hook script is unverified there.
- **Automatic model fallback gets no rules.** In the pilot, Claude Code switched Fable and Opus to Opus 4.8 and Sonnet 5.5 to Sonnet 5 on one task; noonsight only sent a note retiring the old rules.
- **Smaller costs.** Each hook adds 50 to 90 ms of processor time, and `/fork` is unavailable in sessions started with `noonsight run`.
- **Review the code before installing.** It writes to every Claude Code `settings.json` in your account; I did not audit the source beyond a search for network and process calls.

**What it guarantees:** On the Claude Code versions it was tested on, a request carries the rules configured for the model it runs on (99.9% and 100% of requests in two 300-session fuzz runs against a stand-in API). That rests on hook behaviour checked one version at a time, and does not cover whether the model follows the rules or the work improves.
