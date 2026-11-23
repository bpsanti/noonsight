I read the README, the docs, the evidence map and the committed benchmark results; I could not build it or run its tests, so this rests on a read-through, not a run.

**Verdict:** adopt with conditions — as a time-boxed pilot on a few machines, not a team-wide rollout yet.

**Reasons:**
- **It fits your setup.** It delivers per-model rules to sessions and subagents through Claude Code hooks, and its own guidance is to skip it if every session runs one model.
- **Subagents are where it beats the built-in options.** In its benchmark a shared `CLAUDE.md` reached 32.2% of subagent requests (39 of 121) and never reaches the built-in Explore and Plan subagents; noonsight reached 100%. For the main conversation a `CLAUDE.md` already reaches 100% (526 of 526).
- **It sends less irrelevant text.** About 79% of the rule text in a request was written for that model, against 31.5% with a `CLAUDE.md`, and it added roughly 1,155 characters per request against 4,415.
- **Low operational risk.** The hooks never block a call, use no network (except an optional classifier, off by default), have no runtime dependencies, and `noonsight uninstall` removes them. A repository's rules apply only after each person runs `noonsight trust`.
- **The delivery evidence is weaker than the headline.**
  - The "0 of 300 sessions" run is really 0 of 299; one session did not run.
  - That run reuses the same random seed whose failures were just fixed, so it is not a held-out test.
  - The benchmark's own self-check caught planted bugs in only 4 of 9 and 7 of 15 exposed sessions.
  - Correctness is judged against noonsight's own resolver, and no request reached a real model.
- **It is very young.** Every measurement is dated 14–23 November 2026, the last one today. Nine delivery bugs were found and fixed in that time, five of them when the test generator was widened, so untested paths probably hold more.
- **It is not a released package.** `package.json` says version 0.0.1 and `private`, install is from a git clone, and the README says the npm name holds an empty placeholder.
- **No measured gain in results.** Its 588-run paid pilot saw no measurable difference in task outcomes, at about 7% more cost per run. The rule effects that did show up are on small tasks with 30–40 runs per arm, and `verify-changes` roughly doubled the cost of a small Sonnet fix ($0.024 to $0.051).
- **The default preset does little for attended Opus and Fable.** Those sessions receive nothing until you enable rules or write your own. The value out of the box is in subagents, headless runs, and Sonnet/Haiku after a code edit.

**Conditions and risks:**
- **Pin Claude Code.** Results exist only for 2.1.328 and 2.1.330, and CI pins 2.1.325. The tool depends on undocumented behaviour (an undocumented environment variable, transcript and metadata file formats), so an auto-update can break delivery silently. Re-run its corpus (`npm run delivery -- corpus`) before each upgrade.
- **Pin a reviewed commit.** Install from a clone you have read, and do not use `npx noonsight` until the author publishes a real version.
- **Write your own rules.** The benefit depends on rules your team has that differ by model; without them there is little to deliver.
- **Review `.noonsight/` changes like code.** Once a repository is trusted, later changes to its rules apply on pull without asking again, which is a route for injecting instructions into everyone's sessions.
- **Check your organisation's settings.** The machine-wide install was never tested live and is ignored on logins with server-managed settings. An organisation that disables user hooks stops the per-account install too.
- **Know the gaps.** Workflow agents get nothing. Agent teams, routing and the classifier are unmeasured. On macOS it reads the model from `ps` output, which can be ambiguous.
- **Watch automatic model fallbacks.** In the pilot, sessions that switched automatically from Fable 5.2 to `claude-opus-4-8`, or from Sonnet 5.5 to `claude-sonnet-5`, received only the retirement note and no rules.
- **Audit with `noonsight report`, knowing its limit.** The log records what the hook returned, not what reached the model.
- **Set an exit test.** If after two or three weeks you cannot point to a behaviour your own rules changed, remove it; a `CLAUDE.md` is simpler.

**What it guarantees:** Nothing contractually (MIT, no warranty); its claim is that on the Claude Code versions it was tested on, each session and subagent is handed the rule text configured for the model it runs on — not that the model obeys it — and that rests on a stub-API fuzz benchmark with a single seed, checked against its own resolver, and on Claude Code hook behaviour that is partly undocumented.
