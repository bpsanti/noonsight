**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines with a pinned Claude Code version, not as a team-wide rollout.

I read the README, the hooks contract, the evidence map, the Claude Code verification table, the benchmark write-ups and the plugin launcher. I did not run the test suite or recompute any number from the raw result files, and I only grepped the TypeScript source, so the figures below are the repo's own claims.

**Reasons**

- **It fits your setup.** It delivers rules per model to sessions and subagents, and again after `/model`, compaction, `/clear`, resume and fork. The README itself says to skip it if every session runs one model.
- **Delivery is well evidenced.** In the current run, 3,090 of 3,090 requests with rules due held them, including 763 of 763 subagent requests (Claude Code 2.1.330).
- **The gain over `CLAUDE.md` is mostly subagents.** A user `CLAUDE.md` reached every main-conversation request but only 60 of 128 subagent requests, never reaching Explore and Plan. It also gives every model the other models' rules.
- **No quality gain is shown.** The paid pilot resolved 133 of 144 tasks without rules, 132 with noonsight and 133 with a `CLAUDE.md`. Measured effects are behaviours on small tasks, such as Sonnet running tests after a fix in 29 of 30 runs against 0 of 30.
- **Out of the box, Opus and Fable attended sessions receive nothing.** Their attended preset rules ship off. No Opus rule has a measured effect, and Fable's `finish-work` advice is already in its own system prompt.
- **It is low-risk to try.** It has no runtime dependencies, the hooks never block a call, and they read only local files by default. A repository's config does nothing until each person runs `noonsight trust`, and `noonsight uninstall` removes it.
- **It is young.** This is version 0.1.0 from a single author. Its own benchmark found nine delivery failures (F1 to F9) in about a week, all fixed before the current run.

**Conditions and risks**

- **Pin Claude Code.** The delivery result holds for 2.1.330 only, and the tool leans on undocumented behaviour (an undocumented environment variable, fork and subagent metadata files). Re-run `noonsight check` and the live tests before each upgrade.
- **Write your own rules.** The value for Opus and Fable depends on rules you supply or enable; check them with `noonsight resolve` and `noonsight report`.
- **Check your subagent patterns against the stated gaps:**
  - Workflow agents get nothing.
  - Parallel foreground calls of one type that need different rules get nothing until their first Edit, Write or agent call.
  - Subagents from organisation-synced plugins are predicted on the parent's model.
  - Agent teams are unmeasured.
- **Keep routing and the classifier off.** Routing rewrites agent calls and by default returns `allow`, which skips the permission prompt; in auto mode it gets sibling calls refused. The classifier sends the first 4,000 characters of a task to a model through your login. Neither is measured.
- **Expect a cost increase.** The pilot showed about 7% more per run overall, and `verify-changes` roughly doubled the cost of the small fix task.
- **Fallback models are not covered.** In the pilot Claude Code switched sessions to Opus 4.8 and Sonnet 5 by itself; the preset has no rules for those models, so such a session gets only a note retiring the earlier rules.
- **Rollout is per person.** Each person installs per login (npm recommended), and sets `session.unattended_when_env` for interactive sessions nobody watches.
- **The evidence is self-graded.** The benchmark uses a stand-in API and noonsight's own resolver as reference, so a wrong resolution would not show. Use the pilot to measure whether your own rules change anything.

**What it guarantees**

noonsight guarantees that the rules declared for a model are placed in the requests of each session and subagent running on it — delivery, not obedience — and that rests on Claude Code's hook behaviour, partly undocumented, as the author measured it on version 2.1.330.
