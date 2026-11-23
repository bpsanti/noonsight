**Verdict:** adopt with conditions — as a time-boxed pilot on a few machines, not a team-wide rollout yet.

I read the README, the hook and install docs, the preset, and the committed benchmark summaries, and searched the source for network and process calls. I did not run the test suite or the tool itself.

**Reasons:**
- **It fits your setup.** It delivers each model's rules to sessions and to every subagent, including the built-in Explore and Plan subagents, which a `CLAUDE.md` never reaches. In its delivery benchmark a `CLAUDE.md` covered 32.2% of subagent requests (39 of 121) against 100% for noonsight.
- **A `CLAUDE.md` already covers the main conversation.** It reached 526 of 526 main-conversation requests, so the gain is in subagents and in not giving every model the other models' rules.
- **The shipped preset did not improve results.** In the paid pilot, runs resolved 133 of 144 without it and 132 of 144 with it, at about 7% more cost. The value has to come from rules you write.
- **The preset does little out of the box.** A watched Opus or Fable session receives nothing from it; Sonnet and Haiku receive `verify-changes` only after editing a tracked code file.
- **Some rules do change behaviour.** `verify-changes` made Sonnet run the tests after a fix in 29 of 30 runs against 0 of 30 without, at roughly double the cost of that small task. These are small tasks with 30 to 40 runs per arm.
- **It is low-risk to try.** The hooks always exit 0, never block a call, and I found no network code in `src`. It has no runtime dependencies, is MIT licensed, and `noonsight uninstall` removes the hooks.
- **It is very young.** `package.json` says 0.0.1 and private, it is not on npm, it has one author, and all the evidence dates from 16–21 November. The fuzzer found four delivery bugs in that window, the last two fixed a day before the headline run.
- **The headline numbers have limits.** They come from one Claude Code version (2.1.328) against a stub API, with noonsight's own resolver as the reference. The README's "100%" rows come from the build before the last two fixes.

**Conditions and risks:**
- **You need rules that differ by model.** If you have none, or all your rules apply to every model, a `CLAUDE.md` is simpler; the README says so itself.
- **Pin both versions.** Pin a noonsight commit and re-run its delivery corpus on each Claude Code upgrade. It relies on an undocumented environment variable and on resume behaviour recorded on one version.
- **Check your organisation's settings first.** `allowManagedHooksOnly` or `disableAllHooks` stops the per-account install, and server-managed settings make Claude Code ignore the machine-wide one.
- **Each person installs from a clone.** The hook points at absolute Node and noonsight paths, so a Node upgrade or a moved clone silently stops delivery until `noonsight check` is run.
- **Subagents it misses.** Agent-team teammates, plugin-defined subagents, `--agents` definitions, and calls held more than two minutes on a permission prompt get no rules or the wrong model's. Parallel calls of one type that need different rules get none.
- **Fallback models are undeclared.** In the pilot Claude Code switched models on its own to Opus 4.8 and Sonnet 5 on one task; those sessions got a retirement note and no rules.
- **Leave routing and the classifier off.** Routing rewrites agent calls and by default approves them without a permission prompt; the classifier sends the first 4,000 characters of a task to a model.
- **Repository rules are trusted once.** After `noonsight trust`, later changes to a repository's rules apply without asking again, so review `.noonsight/` changes like code.
- **Not measured.** Project configurations, plan mode, forks, `/resume` inside a session, `noonsight run`, and subagents that edit files.
- **Unverifiable here.** This directory is not a git repository, so I could not confirm the code matches the benchmarked commit `d5fd71f`.

**What it guarantees:** noonsight guarantees only that each session and subagent is handed the rule text configured for the model it runs on (3,219 of 3,221 requests in its own fuzz run), not that the model obeys it or that results improve, and that rests on a self-run stub-API benchmark on Claude Code 2.1.328.
