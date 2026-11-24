**Verdict:** adopt with conditions — as a time-boxed pilot on a few machines, not a team-wide rollout yet.

I read the docs, the evidence map, the result summaries and the hook manifest. I ran nothing (no tests, no build) and did not audit the `src/` code line by line, so the numbers below are the project's own.

**Reasons:**

- **It fits your setup.** It delivers per-model rules to sessions and subagents, and its own README says to skip it when every session runs one model. You run four models with many subagents.
- **The subagent gap it closes is real, by its own measurement.** A `CLAUDE.md` holding every model's rules reached 100% of main-conversation requests but only 46.9% (60 of 128) of subagent requests. noonsight reached 763 of 763, and 3,090 of 3,090 overall, on Claude Code 2.1.330.
- **No quality gain is shown.** In the rule-effect runs all 600 passed their hidden check with or without rules. The paid pilot resolved 133 of 144 tasks without rules, 132 under noonsight and 133 with a `CLAUDE.md`.
- **What the rules do change is behaviour, at a cost.**
  - `verify-changes` got Sonnet and Haiku to run tests after a fix (29 and 27 of 30, against 0 without) and roughly doubled the cost of that small task.
  - `carry-through` took Sonnet from 9 to 32 of 40 completed backlogs at no extra cost; on Haiku it showed no effect.
  - No Opus rule has a measured effect.
- **Out of the box it does little for interactive work.**
  - Attended Opus and Fable sessions receive nothing from the preset.
  - Attended Sonnet and Haiku sessions receive only `verify-changes`, after their first tracked code edit.
  - Opus subagents receive nothing.
  - Scoped rules need `NOONSIGHT_SCOPE` or match patterns you write; the preset's scopes have none.
- **It is young and tightly coupled to Claude Code internals.** It is version 0.1.0 from a single author, and every experiment ran between 16 and 23 November 2026. It reads transcripts, subagent metadata and process command lines. Its benchmark found nine delivery failures (F1 to F9) in that week, all fixed, most caused by undocumented Claude Code behaviour.
- **The engineering is careful.** Limits are documented, every number links to a raw file a test recomputes, there are no runtime dependencies, and the hooks always exit 0 and never block a call. Repository rules need a per-person `noonsight trust`.

**Conditions and risks:**

- **Write your own rules.** The value is in model-specific rules you actually have; with only the preset, most of your interactive sessions get nothing. Decide which rules differ by model before installing.
- **Pin or recheck Claude Code versions.** Delivery was measured only on 2.1.330, and CI pins 2.1.325. After each upgrade, run `noonsight check` and watch `noonsight report` for `MISMATCH` and undelivered rules.
- **Known delivery gaps.**
  - Workflow agents get nothing.
  - Parallel foreground subagents of one type that need different rules get nothing until their first edit or agent call.
  - Subagents from organization-synced plugins are predicted on the parent's model.
  - Agent teams, routing and the classifier are unmeasured.
- **Managed settings can disable it silently.** If your organization sets `allowManagedHooksOnly` or `disableAllHooks`, user hooks do not run; server-managed settings also make the `--managed` install ignored.
- **Fallback models get no rules.** The pilot logged auto-switches to `claude-opus-4-8` and `claude-sonnet-5`; an undeclared model gets a warning and nothing else.
- **Per-machine footprint.** Each person installs it (Node.js 20+), and it edits every `~/.claude*/settings.json`. A hook runs on every Edit, Write and agent call, at 80 to 150 ms CPU each on a loaded laptop. It keeps a local log of session ids, models and edited file paths.
- **Keep the off-by-default features off.** The classifier sends the first 4,000 characters of a task to a model; routing rewrites agent calls, which in auto mode gets sibling calls refused.
- **Measure your own effect.** The tasks in the evidence are small. Run the pilot for two weeks on your real work and drop any rule that changes nothing you can see.
- **One doc inconsistency.** `docs/install.md` says noonsight runs for no tool call other than the agent tool, but `hooks/hooks.json` also hooks `Edit|Write`.

**What it guarantees:** noonsight guarantees delivery, not obedience — the rules declared for a model are put into the requests of each session and subagent running on it, and again after a model switch, compaction, clear, resume or fork, minus the documented gaps. That rests on Claude Code's hook behaviour as the author observed it on version 2.1.330, in one benchmark against a stand-in API that checks delivery against noonsight's own resolver.
