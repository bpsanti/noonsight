**Verdict: adopt with conditions.** Run it as a pilot on a few machines with a pinned Claude Code version, not as a team-wide rollout yet.

I read the README, the hook contract, the install and verification docs, the preset, the changelog and the benchmark results, and searched `src` for network and process calls. I did not run the tool or its tests, so the numbers below are the repository's own, not reproduced by me.

## Reasons

- **It fits your setup.** It delivers each session and subagent the rules for the model it actually runs on, and again after `/model`, `/compact`, `/clear`, resumes and forks.
- **The native alternative misses subagents.** In its benchmark, one `CLAUDE.md` holding every model's rules reached 88.2% of requests and 46.9% of subagent requests, and never reached the built-in Explore and Plan subagents. Only about a third of the rule text a model received was written for it.
- **The delivery evidence is strong for the versions tested.** On Claude Code 2.1.330, 0 of 299 fuzzed sessions broke the delivery invariant (3,090 of 3,090 requests, 763 of 763 for subagents). The harness also catches planted bugs.
- **It is low-risk to run.** There are no runtime dependencies, and the hooks always exit 0, never block a call and have a 10-second timeout. `src` has no network calls; it only starts `ps`, `git` and `claude`. `noonsight uninstall` removes its own hook entries only.
- **It is young and moving fast.** It is unpublished (`package.json` says 0.0.1, private) and installed from a clone with `npm link`. Its own fuzzer found nine delivery failures in about a week, the last ones fixed in the run dated today.
- **Delivery has not been shown to improve results.** In the paid pilot, 132 of 144 tasks resolved with it against 133 of 144 without, at about 7% more cost per run. The measured rule effects are on small tasks with 30 to 40 runs per arm.
- **The preset does little for interactive Opus and Fable sessions.** Their attended rules all ship off, so those sessions receive nothing until you enable rules or write your own.

## Conditions and risks

- **Pin Claude Code and re-check on every upgrade.** It relies on undocumented behavior, such as `CLAUDE_CODE_SESSION_ATTENDED`, transcript fields and subagent metadata files, checked only on 2.1.325 to 2.1.330. Run `npm run delivery -- corpus` (no login or tokens needed) before each upgrade, because a break would be silent.
- **Have rules that really differ by model.** The docs themselves say a `CLAUDE.md` is simpler otherwise. Keep shared rules in `CLAUDE.md`.
- **Measure your own rules.** Delivery is not obedience, and `verify-changes` roughly doubled the cost of a small fix ($0.024 to $0.0505).
- **Check your organization's settings.** `allowManagedHooksOnly` or `disableAllHooks` in managed settings stops the per-account hooks; `noonsight check` reports this. Each person installs separately, and Windows is not supported.
- **Review changes to `.noonsight/` like code.** Once someone runs `noonsight trust` in a repository, later pulled changes to its rules apply without asking again. That makes it a route for injected instructions.
- **Know the gaps:**
  - Workflow agents get nothing.
  - Agent teams, routing and the classifier are unmeasured.
  - Fallback models get only a note: when Claude Code auto-switched to Opus 4.8 or Sonnet 5 in the pilot, the session was told the old rules no longer apply and received no new ones.
  - After a model switch, the earlier model's rules stay in context alongside a note retiring them.
- **Use the decision log with care.** `noonsight report` shows what the hooks returned, not what reached the model.

## What it guarantees

It guarantees only that the rules you declare for a model are handed to Claude Code as hook context for sessions and subagents on that model — not that the model obeys them. That rests on its own fuzz benchmark against a stand-in API on Claude Code 2.1.328 and 2.1.330, and on hook behavior that Claude Code can change.
