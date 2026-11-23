**Verdict: adopt with conditions.** Pilot it on a few machines with a pinned Claude Code version, and use it for your own per-model rules and subagents. Do not roll it out team-wide as it stands today.

I read the README, the hooks contract, the evidence map, the preset and its sources, and the benchmark and delivery write-ups. I did not run the tests, build it, or read the hook source, so everything below rests on the project's own documentation and committed results.

**Reasons**

- **It fits your setup.** It gives each session and subagent the rules for the model it actually runs on, and re-delivers on `/model`, `/compact`, `/clear`, resumes and forks. Its own advice is to skip it if every session runs one model, which is not you.
- **The gap it closes is subagents.** A user `CLAUDE.md` holding every model's rules reached 100% of main-conversation requests (526 of 526) but only 32.2% of subagent requests (39 of 121). It never reaches the built-in Explore and Plan subagents. noonsight reached 100% of subagent requests on the same sequences.
- **Each model gets less of the other models' text.** 79% of the delivered rule text was written for the request's model, against 31.5% with `CLAUDE.md`.
- **No quality gain is shown.** In the 588-run paid pilot, 133, 132 and 133 of 144 tasks were resolved with no rules, noonsight and `CLAUDE.md`. noonsight cost about 7% more per run than no rules, and `CLAUDE.md` about 19% more.
- **The preset does little for attended work out of the box.** Attended Opus and Fable sessions receive nothing until you enable a rule. Attended Sonnet and Haiku sessions get only `verify-changes`, after the first edit to a tracked code file. Most scoped rules stay dormant because the preset ships no way to detect a scope.
- **Some rules do change behaviour, at a price.** `verify-changes` took Sonnet from 0 of 30 to 29 of 30 runs that ran tests after a one-file fix, and roughly doubled that run's cost ($0.024 to $0.051). Sonnet's `carry-through` raised full completion on a 13-ticket backlog from 9 of 40 to 32 of 40. Haiku's showed nothing there.
- **It is very young.** `package.json` says 0.0.1 and private, it is not on npm, and all results date from 16 to 23 November 2026. Its own fuzzer found nine delivery failures in that week, all reported fixed, the last five in today's run.
- **It is low-risk to try.** The docs say the hooks always exit 0, never block a call, read only local files, and add 50 to 90 ms of processor time each. There are no runtime dependencies, the licence is MIT, and `noonsight uninstall` or `NOONSIGHT_DISABLE=1` turns it off.

**Conditions and risks**

- **Pin Claude Code.** It was measured on 2.1.328 and 2.1.330 only, and leans on undocumented behaviour: fork transcripts, background job state, subagent metadata, and an undocumented environment variable. A Claude Code update can break delivery silently, so re-run its delivery benchmark before each upgrade.
- **Install from a reviewed clone at a pinned commit.** The npm name currently holds an empty placeholder, so `npx noonsight` is not the tool.
- **Write your own rules.** Treat the preset as a starting set, and measure any rule you care about, since delivery is not obedience.
- **Mark unwatched sessions.** Set `session.unattended_when_env` to your orchestrator's variable, or interactive sessions nobody watches count as attended and get the attended rules.
- **Check your subagent patterns against its gaps:**
  - Workflow agents get nothing.
  - Parallel foreground subagents of one type that need different rules get nothing until their first Edit, Write or agent call.
  - Agent teams, routing and the classifier are unmeasured; leave the last two off.
  - Subagents from organisation-synced plugins are predicted on their parent's model.
- **Expect undeclared models.** In the pilot, Claude Code switched models on its own in 20 runs (to Opus 4.8 or Sonnet 5). Those models get a warning and no rules, as will any new model version until the preset declares it.
- **Know what it leaves on each machine.** Session records and a decision log (session ids, edited file names) are kept under `~/.local/state/noonsight`. A per-repository configuration applies only after each person runs `noonsight trust`. A machine-wide install cannot be turned off by a user's `disableAllHooks`.
- **Watch `noonsight report` during the pilot.** Look for `MISMATCH`, `calls-differ` and undeclared-model lines; those are where delivery failed for you.

**What it guarantees**

noonsight guarantees only that each session and subagent is handed the rules declared for its model, with other models' rules retired — not that the model follows them — and that rests on the author's own benchmark against a stand-in API, with one seed, on two Claude Code versions.
