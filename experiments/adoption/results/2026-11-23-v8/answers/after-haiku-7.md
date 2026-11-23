**Verdict: adopt with conditions.** Pilot it on Sonnet and Haiku first, pin the Claude Code version, and don't roll it out to Opus or Fable until you've checked their rules.

**Reasons**

- **It fills a gap that `CLAUDE.md` leaves.** The README's table gives subagent coverage of 100% (763 of 763) for noonsight, against 46.9% (60 of 128) for a user `CLAUDE.md` and 0 for a skill per model. Your team runs many subagents, so this is the main reason to adopt.
- **The coverage numbers check out.** I read `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, key `on-g2-s1-n300`. It shows 300 sessions, 299 ok and 1 `step-timeout`. The `docs/evidence.md` entries D18 to D22 point to the same file. I did not re-run the benchmark or `npm test`.
- **The hooks are low-risk.** The hook code has no blocking or deny path (no `block`, `deny` or `permissionDecision` matches in `hook.ts`). The README says the hooks never use the network. The only network path is the classifier, which is off by default. There are no runtime dependencies.
- **Your model mix gets uneven value from the preset.** Sonnet and Haiku get the most active rules. Opus has no preset rule for `subagent`, and its attended rules ship off, so an attended Opus session gets nothing from the preset until you enable one. Fable's attended rules also ship off. Use the preset for Sonnet and Haiku, and write your own rules for Opus.
- **The measured effects are narrow.** Only `verify-changes` on Sonnet and Haiku (29/30 and 27/30 runs versus 0/30 with no rule) and `carry-through` on Sonnet (9/40 to 32/40) show a measured effect. The README says these come from small tasks with 30 to 40 runs per arm.

**Conditions and risks**

- **Pin the Claude Code version.** The delivery guarantee is measured only on 2.1.330, and the README says Claude Code changes how hooks behave. Before anyone upgrades, re-run `npm run delivery` or at least `npm test`. Check the version your team runs.
- **Set up unattended runs correctly.** Interactive sessions count as attended unless `session.unattended_when_env` names a variable that your CI or orchestrator sets. Otherwise, unwatched sessions may get the wrong rules.
- **Expect a cost increase on some tasks.** `verify-changes` roughly doubled the cost of a small Sonnet fix ($0.0240 to $0.0505). Watch spend in the first weeks.
- **Known gaps.** Agents started by a workflow get nothing. Plugin-provided subagents, such as ones an organization syncs, are predicted on their parent's model. Agent teams, routing and the classifier are not measured. A session that is compacted and then resumed with no model named runs on Claude Code's default model.
- **Repository rules are prompt text.** A committed `.noonsight/noonsight.json` changes what the model is told. Require `noonsight trust` by each person who clones a repo, and review rule changes in code review as you would any prompt change.
- **Delivery is not obedience.** The guarantee covers what reaches the model, not what the model does with it. Use `noonsight report` for delivery. Use your own tests to check behaviour.
- **Maturity.** The package is version 0.0.1, marked private, and not on npm. Install it from a clone, and make sure someone on the team owns updates.

**What it guarantees:** In the benchmark run, every request with rules due received the rules that noonsight assigns for its model, scope, place and triggers (3,090 of 3,090, including 763 of 763 subagent requests), on Claude Code 2.1.330 with a stand-in API. That rests on the hook code and the local benchmark in `experiments/delivery`, which I did not re-run. It does not guarantee that the model follows the rules.
