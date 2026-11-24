**Verdict:** adopt with conditions. Run it as a time-boxed pilot on a few machines with rules you write yourselves, not as a team-wide rollout yet.

This rests on reading the README, the hooks, install and evidence docs, the changelog, the plugin hook file and launcher, and a search of the source for process and network use. I did not run the tool, its tests or its benchmarks, and I did not check its claims about Claude Code against Claude Code itself.

**Reasons:**
- **It targets your exact gap.** In its own benchmark, a user `CLAUDE.md` reached every main-conversation request but only 60 of 128 subagent requests, and never reaches the built-in Explore and Plan subagents. noonsight reached 763 of 763 subagent requests and 3,090 of 3,090 overall.
- **Delivery is not better results.** Its paid pilot passed 133 of 144 tasks without rules, 132 under noonsight and 133 with a `CLAUDE.md`. On the rule-effect tasks, all 600 runs passed with or without rules.
- **Measured behaviour changes are narrow.** Three preset rules show an effect, on small tasks, for Sonnet, Haiku and Fable; no Opus rule has one. `verify-changes` took Sonnet from 0 of 30 to 29 of 30 runs that ran tests after a fix, at about double the cost of that cheap task.
- **The preset gives your interactive Opus and Fable sessions nothing by default.** Their attended rules ship off, so the value for you is mostly in your own rules.
- **It is very young.** It is version 0.1.0 from a single author, and its benchmark found nine delivery failures, the last five fixed just before the current run of 2026-11-23.
- **It leans on Claude Code internals.** Several behaviours it depends on are undocumented, and each result holds only for the version it ran on (2.1.325 to 2.1.330).
- **The evidence is self-measured.** Sessions were real but the API was a local stand-in, and the reference for "correct rules" is noonsight's own resolver, so a wrong resolution would not show.
- **The downside of trying it is small.** Hooks always exit 0 and never block a call, there are no runtime dependencies, and the source search found no network code. The only child processes are `git`, `ps` and `claude`. `noonsight uninstall` removes only its own entries.

**Conditions and risks:**
- **Platform and policy:** it needs macOS or Linux, Node.js 20 or newer, and an organisation that permits user hooks. `noonsight check` reports when managed settings stop them.
- **Claude Code upgrades:** treat each upgrade as a possible break. Run `noonsight check` and read `noonsight report` for `MISMATCH`, `calls-differ` and undeclared-model lines afterwards.
- **Subagent gaps that matter to you:**
  - Workflow agents get nothing.
  - Parallel foreground calls of one subagent type that need different rules get nothing until their first Edit, Write or agent call, so read-only ones never do.
  - Subagents from organisation-synced plugins are predicted on their parent's model.
  - Agent teams in split panes are untested.
- **Model detection gaps:** `default` and `opusplan` cannot be resolved, and aliases on Bedrock, Vertex or Foundry need pinning variables; these get a warning instead of rules.
- **Leave routing and the classifier off.** Neither is measured; the classifier sends the first 4,000 characters of a task to a model, and routing in auto mode causes other calls in the same response to be refused and retried.
- **Keep rules where they belong.** Put what every model needs in `CLAUDE.md`, only per-model differences in noonsight, and anything that must never be broken in a hook or permission rule.
- **Control changes.** Pin the noonsight version, set `on_preset_change` to `hold`, and remember each person must run `noonsight trust` once per repository before its rules apply.
- **Measure your own rules.** Set an exit criterion for the pilot, such as a visible change on your tasks, since a rule that changes nothing still costs tokens. Each hook run adds roughly 80 to 150 ms of processor time.

**What it guarantees:** It guarantees delivery, not obedience — the rules declared for a model are placed in the requests of the sessions and subagents running on that model, and again after a model switch, compaction, clear, resume or fork. That rests on Claude Code's hooks behaving as the author recorded them on versions 2.1.325 to 2.1.330, and on the author's own stand-in-API benchmark (0 of 299 sessions broken).
