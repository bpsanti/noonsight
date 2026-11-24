**Verdict:** adopt with conditions, as a time-boxed pilot on a few machines rather than a team-wide or machine-wide rollout.

I read the docs, the hook contract, the committed result files and parts of the source, but ran nothing. This copy has no build, no git history and no CI files, so the test suite's own checks are unverified by me.

**Reasons:**

- **It fits your setup.** It delivers per-model rules to sessions and subagents. Its own benchmark shows a single `CLAUDE.md` reaches every main-conversation request but only 60 of 128 subagent requests, and never the built-in Explore and Plan subagents.
- **The delivery claim checks out against the raw file.** The current run's `summary.json` shows 300 sessions generated, 299 completed, 3,090 of 3,090 requests with rules due covered, 763 of 763 for subagents, and no request with another model's rules left unretired. I found no network calls in `src/`, and the child processes it starts are the ones the docs list.
- **The evidence is narrower than "100%" suggests.**
  - The sessions ran against a stand-in API, on one Claude Code version (2.1.330), in one run dated today.
  - The reference for "right rules" is the tool's own resolver, so a wrong resolution would not show.
  - Its self-check caught only 4 of 9 and 7 of 15 exposed sessions for two of the three planted bugs.
- **No quality gain is shown.** The paid pilot passed 133 of 144 tasks without rules, 132 under noonsight and 133 with a `CLAUDE.md`. In the fix-and-bug run, all 600 runs passed with or without rules.
- **The measured effects are behavioural and uneven across your models.**
  - Sonnet and Haiku ran tests after their last edit far more often (for example 29 of 30 against 0 of 30), at roughly double the cost on those small tasks.
  - Fable's only measured effect is shorter sentences in reports.
  - Opus has no measured effect at all.
  - Out of the box, an attended Opus or Fable session receives nothing from the preset.
- **It is young and tied to Claude Code internals.** It is version 0.1.0 from a single author, with all measurements from the last eight days. Nine delivery failures were found and fixed in that time, across Claude Code 2.1.325 to 2.1.330. It relies on undocumented behaviour, such as an undocumented environment variable, transcript and job-state file fields, and facts read from Claude Code's bundled code.
- **The downside is small.** The hooks always exit 0 and never block a call, there are no runtime dependencies, and `noonsight uninstall` or `NOONSIGHT_DISABLE=1` turns it off.

**Conditions and risks:**

- **You need rules that differ by model.** If your rules are the same for every model, a `CLAUDE.md` is simpler, and the README says so. Write your own rules and measure them; the preset alone gives your Opus and attended Fable sessions little or nothing.
- **Pin the Claude Code version and re-check on upgrade.** Each result holds only for the version it ran on. Re-run the delivery corpus (a few minutes, no login or tokens) before moving the team to a new version.
- **Check your subagent paths against the gaps.**
  - Workflow agents get nothing.
  - Subagents from organization-synced plugins are predicted on the parent's model.
  - Parallel same-type calls needing different rules get nothing until the subagent's first Edit, Write or agent call.
  - Agent teams, routing and the classifier are unmeasured.
- **Use the per-account install, not `--managed`.** The machine-wide install needs sudo and users cannot turn it off with `disableAllHooks`. Treat `noonsight trust` like code review, because a trusted repository config injects text into every session there.
- **Do not treat `noonsight report` as proof of receipt.** The log records what the hook returned, not what reached the model; it differed from the observed requests in 135 of 299 sessions on character counts.
- **Expect overhead.** Each hook costs about 80 to 150 ms of CPU (measured on a loaded laptop), and a subagent start can wait up to 2 more seconds. Long sessions with model switches accumulate retired rules and notes; only about 48% of the delivered text was the first copy of a rule that applied.
- **It keeps local state.** Session ids, models and edited file paths go to `~/.local/state/noonsight/`, and it reads transcripts and the `claude` command line.
- **A silent miss is the main failure mode.** After a Claude Code change, a session could get no rules or the wrong model's rules. The post-start check warns on a subagent model mismatch, but nothing catches a dropped delivery outside the benchmark.

**What it guarantees:** noonsight guarantees delivery, not obedience — the rules declared for a model are placed into the requests of each session and subagent running on it, and again after a model switch, compaction, clear, resume or fork, within its documented limits — and that rests on Claude Code's hook behaviour (partly undocumented) as measured against a stand-in API on version 2.1.330.
