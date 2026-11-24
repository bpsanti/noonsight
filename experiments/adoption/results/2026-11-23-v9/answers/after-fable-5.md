**Verdict:** adopt with conditions, as a time-boxed pilot on a few machines rather than a team-wide rollout.

I read the README, the hook and install docs, the evidence map, the benchmark summaries and the changelog. I ran nothing: there is no built `dist/` here and I had no shell, so the test suite and the claim that it recomputes every number are unverified. I did not audit the hook source line by line.

**Reasons:**
- **It targets the gap you have.** In its delivery benchmark, a `CLAUDE.md` reached every main-conversation request (448 of 448) but only 46.9% of subagent requests (60 of 128), and never the built-in Explore and Plan subagents. noonsight reached 763 of 763 subagent requests.
- **It keeps other models' rules out.** With every model's rules in one `CLAUDE.md`, only 32.6% of the rule text in a request was written for that request's model, against 78.6% under noonsight. It also added fewer characters per request (1,343 against 4,472).
- **The measured benefit is behaviour, not quality.** `verify-changes` made Sonnet 5.5 and Haiku 5.5 run tests after edits (29 and 27 of 30, against 0 of 30). `carry-through` helped Sonnet finish a 13-ticket backlog (32 of 40 against 9 of 40). But all 600 runs passed their hidden check with or without rules, and the paid pilot resolved 133, 132 and 133 of 144 tasks with no rules, noonsight and a `CLAUDE.md`.
- **The preset does little for Opus and Fable.** No Opus 5.5 rule has a measured effect. Attended Opus and Fable sessions receive nothing by default. Fable's one measured effect is shorter sentences in its reports.
- **The rules cost money.** `verify-changes` roughly doubled the cost per run on small tasks ($0.0505 against $0.0240 on Sonnet). The paid pilot averaged $0.155 per run with noonsight against $0.145 without, still below the `CLAUDE.md` arm's $0.173.
- **It is very young.** This is version 0.1.0 from a single author, and every experiment ran between 16 and 23 November 2026. The benchmark found nine delivery failures in that week; all are fixed, the latest in the build measured today.
- **The footprint is modest and reversible.** It has no runtime dependencies and is MIT licensed. The hooks always exit 0 and never block a call, and they use no network unless you turn on the optional classifier. A repository's rules do nothing until each person runs `noonsight trust`. `noonsight uninstall` removes only its own entries.

**Conditions and risks:**
- **Write your own rules.** The value for you is the delivery mechanism; the preset alone gives your Opus and Fable sessions almost nothing. Each rule you add has no known effect until you measure it.
- **Declare your exact model identifiers.** Rules bind to exact IDs, and the preset covers only Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5. Any other version gets a warning and no rules. In the paid pilot, Claude Code auto-switched some sessions to `claude-opus-4-8` and `claude-sonnet-5`, where noonsight delivered only the note retiring the old rules.
- **Pin Claude Code and re-check on each upgrade.** Delivery is verified only on 2.1.330, and Claude Code went from 2.1.325 to 2.1.330 during the project's own week of testing. Several mechanisms rely on undocumented behaviour, such as fork origins and subagent metadata. Run `noonsight check` and the delivery corpus after each upgrade.
- **Check the gaps against how you start subagents.**
  - Workflow agents get nothing.
  - Subagents from plugins your organisation syncs are predicted on the parent's model.
  - Parallel foreground calls of one type that need different rules get theirs late or not at all.
  - Agent teams, routing and the classifier are unmeasured.
  - `/fork` is unavailable in sessions started with `noonsight run`.
- **Check your environment.**
  - Windows is unsupported.
  - Organisation managed settings (`allowManagedHooksOnly`, `disableAllHooks`) can silently stop the hooks.
  - Each person must run `noonsight install`.
  - Each new Claude Code login needs a re-run or the watcher.
- **Treat the 100% as the author's own figure.** It comes from one seed on one macOS laptop, against a stub API, with noonsight's own resolver as the reference. A wrong resolution would not show. The self-check caught only 4 of 9 and 7 of 15 exposed sessions for two of its three planted bugs.
- **Expect some overhead and local state.** Each hook run costs about 80–150 ms of CPU on session start, agent calls and file edits. The decision log under `~/.local/state/noonsight/` records session IDs and edited file paths.
- **Set an exit test for the pilot.** Use `noonsight report` to confirm rules reach your subagents, and drop the tool if you see no visible change in behaviour after a few weeks.

**What it guarantees:** noonsight guarantees that the rules declared for a model are placed into the requests of each session and subagent running on that model, and re-delivered on model switch, compaction, clear, resume and fork. That is delivery, not obedience, and it rests on Claude Code's hook behaviour as observed on version 2.1.330 in the author's own stub-API benchmark.
