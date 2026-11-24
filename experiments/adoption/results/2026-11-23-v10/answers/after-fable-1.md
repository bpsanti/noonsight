**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines, not a team-wide rollout yet.

I read the README, the hooks contract, the delivery benchmark and its current results, the paid pilot results, the changelog, and parts of the install docs and source. I could not run the test suite or the benchmark here, so every number below is the author's own committed result, not something I reproduced.

**Reasons**

- **It fits your setup.** It delivers per-model rules to sessions and subagents, and redelivers them after `/model`, compaction, `/clear`, resume and fork. A team on four models with many subagents is its target case.
- **It closes a real gap in `CLAUDE.md`.** In the benchmark, a user `CLAUDE.md` reached every main-conversation request but only 46.9% (60 of 128) of subagent requests. It never reaches the built-in Explore and Plan subagents, and it gives every model the other models' rules too.
- **The delivery evidence is strong but narrow.** The current run reports 0 of 299 sessions breaking the invariant, and 3,090 of 3,090 requests holding their rules (763 of 763 for subagents). That is one seed, one laptop, one Claude Code version (2.1.330), against a stand-in API, with the tool's own resolver as the reference.
- **The benchmark's own self-check is partial.** For two of the three planted bugs it caught only 4 of 9 and 7 of 15 exposed sessions, so "0 failures" is weaker than it reads.
- **Delivery is not a quality gain.** The paid pilot resolved 133 of 144 tasks without rules, 132 with noonsight and 133 with a `CLAUDE.md`. Runs cost about 7% more with noonsight's rules, against 19% more with the `CLAUDE.md`.
- **Some rules do change behaviour, on small tasks.** With `verify-changes`, Sonnet ran tests after its last edit in 29 of 30 runs against 0 of 30 without. Nothing is measured for any Opus rule.
- **It is very young.** It is version 0.1.0 by a single author, and nine delivery failures (F1 to F9) were found and fixed within about a week before the current run.
- **It is low-risk to try.** The hooks always exit 0, never deny a call, and have a 10-second timeout. There are no runtime dependencies, and I found no network modules imported in `src`; the only child processes are `ps`, `git` and `claude`. `noonsight uninstall` removes the hooks.

**Conditions and risks**

- **You need rules that actually differ by model.** If your rules are the same for every model, a `CLAUDE.md` is simpler; the README says so itself.
- **The preset does little for attended Opus and Fable sessions.** Their attended rules ship off, so those sessions receive nothing until you enable rules or write your own.
- **Only four model ids are covered.** Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5 are declared; any other model gets a warning and no rules. In the pilot, Claude Code switched models by itself to Opus 4.8 and Sonnet 5 in 20 of 21 runs of one task.
- **Pin Claude Code versions during the pilot.** Several mechanisms rest on undocumented Claude Code behaviour recorded on 2.1.330, so an update can break delivery silently. Re-run the delivery corpus on each new version.
- **Known gaps may match your usage.** Check whether any of these apply to you:
  - Workflow agents get nothing.
  - Subagents from organization-synced plugins are predicted on their parent's model.
  - Agent teams in split panes are unchecked.
  - `default` and `opusplan` model settings cannot be resolved.
  - On Bedrock, Vertex or Foundry, aliases need the pinning variables.
- **Leave routing and the classifier off.** Neither is measured, routing rewrites agent calls, and the classifier sends task text to a model.
- **Platform and rollout friction.** Windows is not supported. Repository rules need each person to run `noonsight trust` once. A machine-wide install cannot be turned off by `disableAllHooks`.
- **Audit with the decision log, knowing its limit.** `noonsight report` shows what the hooks returned to Claude Code, not what reached the model or whether it was followed.
- **Set an exit criterion.** Before starting, decide which behaviour you expect to change (for example tests run after edits) and drop it if you cannot see it.

**What it guarantees**

noonsight guarantees that the rules declared for a model are placed in the requests of each session and subagent running on that model (delivery, not obedience), and this rests on Claude Code's hook behaviour, partly undocumented, as the author measured it on version 2.1.330.
