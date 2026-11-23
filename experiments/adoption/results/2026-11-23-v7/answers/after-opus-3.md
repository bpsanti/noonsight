**Verdict: adopt with conditions.** Run it as a time-boxed pilot first, not a team-wide rollout.

**Reasons**

1. **It addresses your exact setup.** Your team mixes four models and uses many subagents, and that's where the built-in ways of giving Claude rules fall short. In the tool's own benchmark, a user `CLAUDE.md` got the rules to only 32.2% of subagent requests (39 of 121). It never reaches the built-in Explore and Plan subagents. It also sends every model the other models' rules: only 31.5% of the rule text in a request was meant for that request's model. Noonsight reached 100% of subagent requests, with 79.0% of the rule text meant for the receiving model (`docs/evidence.md` D10, D12, D3, D20).
2. **The evidence is unusually disciplined.** Every number traces to a committed raw file, and `npm test` recomputes it. The tests also check that the planted failures are caught. The limits are written down honestly: the README itself says that a delivered rule is context, not obedience (`README.md:45`).
3. **It is very young.** It's at version 0.0.1/0.1, not on npm, and the whole changelog falls between about 14 and 23 Nov 2026. Each time the fuzz tester added new paths, it found new failures: F1–F4, then F5–F9 when it added forks, plan mode and `/resume`. The clean 0-of-299 result (D18) was measured today on a build with five fixes from today. Nobody outside the project has had time to find the next batch.
4. **It depends on Claude Code internals that change quickly.** The verification table covers Claude Code 2.1.325 through 2.1.330 in nine days. Some of what it relies on is undocumented: the `CLAUDE_CODE_SESSION_ATTENDED` variable, the transcript and `.meta.json` layout, reading `--model` from the parent process through `ps`/`/proc`, and Claude Code silently dropping repeated `SessionStart` context (`docs/verification/claude-code.md:36,45,50`). Any of these can break on an upgrade.
5. **Out of the box it does little for Opus and Fable sessions.** Their preset rules for watched sessions all ship off, so an interactive Opus or Fable session gets nothing until you turn rules on or write your own (`README.md:49`). The rule-effect experiments never tested Opus at all ("left out for its cost", CHANGELOG), and Haiku's `carry-through` showed no effect (R11). The measured effects come from small tasks with 30–40 runs per variant.

**Conditions and risks**

Conditions:
- **You need rules that differ by model.** If your rules are the same for every model, the README itself says a `CLAUDE.md` is simpler (`README.md:238`).
- **Pin both noonsight (a commit from your own clone) and Claude Code.** Before each Claude Code upgrade, rerun its corpus of saved test sessions: `NOONSIGHT_LIVE_DELIVERY=1 npm run test:live` sends nothing to Anthropic. Someone on the team has to own that job.
- **Don't use `npx noonsight` until you've confirmed who controls the npm package.** The name is currently an empty placeholder, which is a supply-chain risk.
- **Check your org's managed settings.** `allowManagedHooksOnly` or `disableAllHooks` turns the tool off. Server-managed settings mean the machine-wide `--managed` install is ignored, so each person needs the per-account install. `noonsight check` reports all of this.
- **Mark unattended runs.** Set `session.unattended_when_env` for orchestrated interactive sessions, and give Sonnet and Haiku sessions a scope. Otherwise most preset rules never fire.

Risks:
- **Silent mis-delivery after a Claude Code upgrade.** The wrong model gets rules, or none arrive. The decision log only records what the hook returned, not what reached the model (`experiments/delivery/README.md:187`), so `noonsight report` won't catch it.
- **Known gaps you may hit:**
  - Workflow agents get nothing.
  - Agent teams, routing and the classifier were never measured.
  - Plugins synced by your org are predicted on the parent's model, so their subagents can get the parent model's rules.
  - Several same-type foreground subagent calls that need different rules get nothing until their first edit or agent call.
  - `/fork` is refused in sessions started with `noonsight run`.
  - `opusplan` isn't handled.
- **Small, real costs.** About 50–90 ms of CPU per hook run, and longer requests. On one task, verification rules roughly doubled Sonnet's cost per run ($0.0240 to $0.0505, R6).
- **Footprint.** `noonsight install` writes hooks into every Claude Code login's `settings.json`. `uninstall` removes them but leaves the config file.

**What it guarantees:** Strictly, nothing. It shows that each model's rule text arrived in nearly all of its own requests (and not in other models' requests). That rests on simulated sessions run against a local stand-in for the API on Claude Code 2.1.328 and 2.1.330, checked against noonsight's own rule resolver, and on Claude Code hook behaviour, some of it undocumented, staying the same in the version you run. It says nothing about whether the models follow the rules.
