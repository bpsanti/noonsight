**Verdict: adopt with conditions.** Run it as a time-boxed pilot first, not a team-wide rollout.

I read the README, `docs/hooks.md`, the delivery benchmark's README, the evidence entries and the version table in `src/adapters/claude-code/compat.ts`. I did not run the test suite or review the hook source line by line.

## Reasons

1. **It solves a real problem for a team like yours.** You run four models and many subagents. In the tool's own benchmark, a user `CLAUDE.md` with every model's rules reached the subagents in only 46.9% (60 of 128) of the requests that needed them. noonsight reached 100% (763 of 763) (`README.md:39-46`). A `CLAUDE.md` never reaches the built-in Explore and Plan subagents at all. It also sends every model the other models' rules.
2. **The evidence is unusually honest and you can check it.** Every number links to a raw result file, and `npm test` recomputes it. Known limits are listed upfront. There is a decision log and a `noonsight report` command, so you can see what was delivered on your own machines.
3. **Getting rules delivered has not been shown to improve the work.** In the paid pilot, the share of runs that passed was the same with no rules, with noonsight and with a `CLAUDE.md`: 133, 132 and 133 of 144 (B1). Only three rules have a measured effect, all on small tasks:
   - `verify-changes` on Sonnet and Haiku
   - `carry-through` on Sonnet
   - `low-context-report` on Fable

   No Opus rule has a measured effect. Where the rules did change behaviour, cost per run roughly doubled, for example $0.024 → $0.0505 on Sonnet (R6).
4. **Out of the box, interactive sessions get little.** Attended Opus and Fable sessions get nothing from the preset, because those rules ship turned off. Sonnet and Haiku get their scoped rules only if `NOONSIGHT_SCOPE` is set. Most of the value comes from your own rules, unattended runs and subagents.
5. **It depends on Claude Code internals that aren't documented.** Fork detection reads `forkedFrom` and a job's `state.json`. It also relies on `CLAUDE_CODE_SESSION_ATTENDED`, the `toolUseId` in subagent metadata, and `ps` output on macOS. All of these were checked only on Claude Code 2.1.325–2.1.330. Because the hooks never block anything, a Claude Code update that breaks them would mostly mean rules quietly stop arriving, not sessions failing.
6. **It is very new.** It is version 0.1.0 with one author, and it was renamed from "sextant". Nine delivery bugs (F1–F9) were found and fixed between about Nov 20 and Nov 23. The run behind the 100% figures is dated today, on one Claude Code version.
7. **Some cases your team will hit are not covered:**
   - Workflow agents get nothing.
   - If one response makes several calls of the same subagent type that need different rules, those subagents get nothing until their first Edit, Write or agent call.
   - Subagents from org-synced plugins are predicted on the wrong model.
   - Agent-team teammates in split panes were never tested.
   - `/fork` is unavailable in sessions started with `noonsight run`.

## Conditions and risks

**What has to hold:**
- **You have rules that really differ by model, or that must reach subagents (including Explore and Plan).** If not, the README itself says a `CLAUDE.md` is simpler.
- **Versions are pinned.** Pin the noonsight version and control Claude Code upgrades. On each upgrade, re-run the tool's corpus checks (`npm run delivery` at the corpus level, plus `npm run test:live`) before rolling out.
- **Scope and attendance are configured.** Set `session.unattended_when_env` to your orchestrator's variable, and set `NOONSIGHT_SCOPE` where you rely on scoped rules.
- **Routing and the classifier stay off.** Neither is measured. Routing in auto mode causes the other agent calls in the same response to be refused. The classifier sends the first 4,000 characters of each task to a model.
- **Each rule earns its place.** Measure its effect on your own tasks and drop it if nothing changes, since the cost rise is real.
- **Someone owns it during the pilot.** They review `noonsight report` weekly for `MISMATCH`, `calls-differ` and `unpredicted` subagents.
- **The source gets reviewed.** It runs as a hook in every session on every login and installs globally from npm. Have someone review it or vendor it, even though it has no runtime dependencies.

**What could go wrong:**
- A Claude Code update silently breaks delivery.
- Wrong-model rules reach a subagent; the after-start check only reports this, it can't undo it.
- Costs rise with no quality gain.
- A single maintainer abandons it.
- Hooks running twice if someone installs both the plugin and the npm version. The tool says it deduplicates, and at worst the rules arrive twice.

## What it guarantees

It guarantees that the rule text you declare for a model gets into the context of every session and subagent running on that model, including after model switches, compaction, clear, resume and fork. It does not guarantee the model follows those rules. That rests on Claude Code's hook behaviour as observed on versions 2.1.325–2.1.330, much of it undocumented. It was measured in 299 real Claude Code sessions talking to a local stand-in for the API, judged against noonsight's own resolver, with the exceptions listed above.
