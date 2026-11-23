Verdict: **adopt with conditions**. Run it as a pilot on a pinned Claude Code version, and don't expect the preset to change how your Opus and Fable sessions behave.

**Reasons**

- **It solves your actual problem.** Your team mixes models and starts many subagents. noonsight resolves rules by model, scope, place and trigger, and delivers them through Claude Code's own hooks (`SessionStart`, `PostModelSwitch`, `SubagentStart` and others). It re-delivers when the model changes and starts subagents with the rules for the model they run on (docs/hooks.md).
- **Delivery to subagents is where it beats the alternatives.** On the same first 60 sequences, 100% of subagent requests had their rules under noonsight. A user `CLAUDE.md` or `.claude/rules` reached 32.2% (39 of 121), and per-model skills reached 0 of 121 (README, D9 to D11). Your session-only requests are fine with `CLAUDE.md`, which scored 100% (526 of 526, D17).
- **The delivery evidence is strong and re-checkable.**
  - On Claude Code 2.1.330, 0 of 300 fuzzed sessions broke the invariant, with 3,090 of 3,090 requests covered (D18, D19).
  - The fuzzer found nine failures (F1 to F9), which were fixed and kept as regression reproductions. The pre-fix reproductions still fail on the old build (D24).
  - `npm test` recomputes every README number from the committed raw files.
- **It is conservative at runtime.**
  - The hooks always exit 0, never block, use no network, and refuse a bad configuration whole instead of guessing.
  - Every decision is logged, and `noonsight report` and `resolve` show what was delivered.
  - Hook cost is 50 to 90 ms of CPU per run (D15).
  - It adds about 1,155 characters per request, against about 4,400 for a `CLAUDE.md` that holds every model's rules (D13).
  - It can be switched off with `NOONSIGHT_DISABLE=1` or `noonsight uninstall`.
- **The authors say plainly what is not shown.** Delivery isn't obedience. Rule effects were measured only on small tasks, with 30 to 40 runs per arm, and only for the preset's rules on Fable, Sonnet and Haiku. The README lists the known limits.

**Conditions and risks**

1. **It depends on undocumented Claude Code behaviour.**
   - Forks, background jobs, the `CLAUDE_CODE_SESSION_ATTENDED` variable, the subagent metadata files and plan-mode model substitution are all undocumented and were recorded on 2.1.325 to 2.1.330 (docs/hooks.md).
   - A Claude Code update can silently break delivery.
   - Pin or stage Claude Code updates, re-run `npm run test:live` and `noonsight check` after each one, and review `noonsight report` weekly.
2. **The preset does almost nothing for Opus and Fable sessions someone is watching.**
   - Those rules ship off. Interactive Opus and Fable sessions receive nothing until you `enable` rules.
   - Sonnet and Haiku interactive sessions get `verify-changes` after a tracked code edit, and nothing else without a scope.
   - Your own rules reach every place, so the value for those sessions comes from rules you write, and you would have to measure whether they help.
   - Set `session.unattended_when_env` for your orchestrators and CI.
3. **Maturity.**
   - Version 0.1 is not on npm. You install from a clone with `npm link`, and the project is a single author's repo.
   - Review the source, since it edits every Claude Code login's settings, and pin a commit.
4. **Known delivery gaps that touch your setup.**
   - A workflow's agents get nothing.
   - Foreground subagent calls of one type that need different rules get nothing until each subagent's first Edit, Write or agent call.
   - A plugin that noonsight does not read, such as one your organization syncs, means subagents are predicted on their parent's model.
   - A conversation compacted with no response since and resumed without a model name runs on Claude Code's default model, which noonsight can't tell.
   - `/fork` doesn't work in `noonsight run` sessions that have rules.
   - Agent teams, routing and the classifier are not measured, and tmux split-pane teammates were not checked. Leave routing and the classifier off.
5. **Costs and effects.**
   - `verify-changes` roughly doubled Sonnet's cost on the small fix ($0.0240 to $0.0505, R6).
   - Haiku's `carry-through` showed no effect on the backlog task (R11).
   - Every rule you add is context, not a guarantee of obedience.
6. **Shared repo rules need a one-time `noonsight trust` per clone.** Until then the repo file changes nothing, so rollout needs a checklist.

**What it guarantees**

It guarantees that a Claude Code session or subagent that receives a rule from noonsight's hooks gets the rules for the model it is running on, and gets them again after a model change. That rests on a fuzzed run of 300 simulated sessions on one Claude Code version (2.1.330) against a local stand-in for the API, where no request reached a real model and every request was read.
