**Verdict:** adopt with conditions, as a time-boxed pilot on a few machines rather than a team-wide rollout.

Basis: I read the README, hook, install and verification docs, the changelog, CI config and the benchmark result summaries, and searched the source for process and network calls. I could not build it or run its tests here, so every number below is the project's own.

**Reasons:**
- **It fits your setup.** It delivers per-model rules to sessions and subagents, and re-delivers after `/model`, `/compact`, `/clear`, resumes and forks. Its own docs say to skip it if every session runs one model.
- **Subagents are where it beats `CLAUDE.md`.** In the latest run, a `CLAUDE.md` holding every model's rules reached 46.9% of subagent requests (60 of 128) and never the built-in Explore and Plan subagents. noonsight reached 763 of 763.
- **The delivery evidence is recent and specific.** On Claude Code 2.1.330, 0 of 299 fuzzed sessions broke the invariant and 3,090 of 3,090 requests carried their rules. The summary file in the repo matches the README on these figures.
- **Failure is benign by design.** Hooks always exit 0, never block a call, and log every decision locally. The source search found no network code, only calls to `ps`, `git`, `claude` and `launchctl`/`systemctl`, which matches the docs.
- **The benefit to outcomes is unproven.** In the paid pilot (588 runs), tasks resolved 133 of 144 without rules and 132 of 144 with them, at 7% more cost. Measured rule effects come from small tasks with 30–40 runs per arm, and none are reported for Opus.
- **Out of the box it does little for attended work.** An attended Opus 5.5 or Fable 5.2 session gets nothing from the preset, and Sonnet/Haiku get one rule after a tracked code edit. The value depends on you writing or enabling model-specific rules.
- **It is very young.** It is version 0.0.1, single-author, not on npm, and about ten days old. The fuzzer found nine delivery failures in that time, five of them fixed today.

**Conditions and risks:**
- **Model coverage.** The preset covers only Opus 5.5, Sonnet 5.5, Haiku 5.5 and Fable 5.2. Any other model gets a warning and no rules until you declare it. In the pilot, Claude Code itself fell back to Opus 4.8 or Sonnet 5 mid-session in 20 of 21 runs on one task; those sessions got only a "rules no longer apply" note.
- **Claude Code version drift.** It relies on undocumented behaviours: an undocumented environment variable, transcript and metadata file layouts, and parsing the `claude` command line. Claude Code moved from 2.1.325 to 2.1.330 during development, and CI still pins 2.1.325. Pin your Claude Code version and re-run `noonsight check` and the live tests before each upgrade.
- **Silent wrong delivery.** A break shows up as missing or wrong-model rules, not an error. Someone has to read `noonsight report` and the `MISMATCH` warnings regularly.
- **Subagent gaps.** Workflow agents get nothing. Parallel foreground calls of one type that need different rules get nothing until their first edit or agent call. Agent teams are unmeasured.
- **Install.** Install from a reviewed, pinned clone using the default per-account install. Do not use `npx noonsight`: the npm name is an empty placeholder today. Windows is unsupported, and an organization policy that allows managed hooks only disables it.
- **Leave optional features off.** Routing rewrites agent calls and, in auto mode, gets sibling calls refused. The classifier sends the first 4,000 characters of a task to a model. The watcher is a resident background process.
- **Repository rules.** Rules committed to a repository are injected into context once each person runs `noonsight trust`, so review changes to them like code. I did not check whether trust is re-asked when the file changes.
- **Exit criterion.** Decide up front what would make you keep it, such as a specific rule that visibly changes subagent behaviour for you. Otherwise you are paying about 7% for delivery alone.

**What it guarantees:** It guarantees nothing in the strict sense; it claims, from the author's own fuzzed benchmark against a stand-in API on one Claude Code version, that each session and subagent receives the rules for the model it runs on and other models' rules are retired. That is delivery, not obedience, and it rests on hook behaviours that Claude Code can change in any release.
