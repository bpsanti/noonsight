**Verdict: adopt with conditions.** Run a pilot on a few machines first, not a team-wide rollout.

I read the README, CHANGELOG, `docs/evidence.md`, `docs/verification/claude-code.md`, the delivery benchmark's failures and limits, and checked `src/` for network and process calls. I did not run `npm test` or the live tests, so the numbers below come from the repo's committed results, not from my own runs.

## Reasons

1. **It fixes a real gap for a team like yours.** Your team uses four models and many subagents. In the repo's benchmark, a user `CLAUDE.md` holding every model's rules reached every request in the main conversation (526 of 526). But it reached only 32.2% of subagent requests (39 of 121), and it never reaches the built-in Explore and Plan subagents. noonsight reached 100% of subagent requests (668 of 668 on Claude Code 2.1.328; 763 of 763 on 2.1.330). If everyone used one model with fixed rules, the README itself says to skip noonsight and use `CLAUDE.md`. That isn't your situation.
2. **The delivery claim is measured carefully and can be checked.** It was tested with 300 randomised sessions covering `/model`, `/compact`, `/clear`, resumes, forks, plan mode and subagents. Each number in `docs/evidence.md` names its raw result file, and `npm test` recomputes it. The fuzzer found nine of the tool's own bugs (F1–F9), all now fixed, each with a regression case kept in the test set. On 2.1.330, 0 of 300 sessions broke the rule, against 1 of 300 on 2.1.328, which was a known limit.
3. **Each model gets less text, and less of other models' rules.** About 1,155 characters per request, against about 4,400 for an all-models `CLAUDE.md`. About 79% of the rule text a request gets is for its own model, against about 31% with `CLAUDE.md`.
4. **The hooks are low-risk.** They have no runtime dependencies, never block, and always exit 0. My grep found no network code in `src/`. The only outside processes are `git`, `ps`, `claude --version` and the optional classifier (off by default). Each hook run takes about 50–90 ms of CPU (median). `NOONSIGHT_DISABLE=1` turns it off for a session, and `noonsight uninstall` removes it.
5. **Measured benefits are modest and partial, which is why this is a conditional yes.** The clearest result: `verify-changes` made Sonnet and Haiku run the tests in 29/30 and 27/30 runs, against 0/30 without rules. But that roughly doubled the cost of a run ($0.024 to $0.0505). Sonnet's `carry-through` helped on one backlog task (32/40 vs 9/40); Haiku's showed no effect there. **No Opus 5.5 rule has a measured effect** (the long-task experiment left Opus out because of cost). Most of these rule experiments used small tasks with 30–40 runs per group.

## Conditions and risks

**What has to hold for it to work:**
- **Pin and recheck the Claude Code version.** The tool depends on how hooks actually behave, including an undocumented variable (`CLAUDE_CODE_SESSION_ATTENDED`), the transcript layout, subagent `.meta.json` files and reading process arguments with `ps`. Each of these was checked only on specific versions (2.1.325–2.1.330). Rerun `npm run test:live` before each Claude Code upgrade.
- **Configure it on purpose; the defaults deliver almost nothing to watched sessions.** A watched Opus 5.5 or Fable 5.2 session gets nothing from the preset, because their rules for watched sessions ship off. Watched Sonnet and Haiku sessions get only `verify-changes`, and only once they edit a tracked code file, unless you set `NOONSIGHT_SCOPE`. Set `session.unattended_when_env` for orchestrator or CI sessions nobody watches. Decide which rules to `enable` and which of your own to add.
- **Treat it as a delivery tool, not a behaviour fix.** A delivered rule is context, not an instruction the model must follow. Keep only rules you can see working in `noonsight report` and in your results.
- **Accept that it's pre-release.** It's version 0.0.1, not on npm, installed from a git clone, and maintained by one person. Pin a commit and review changes before updating.

**What could go wrong:**
- **Install reaches every login.** `noonsight install` writes hooks into every Claude Code configuration directory in your home folder. It keeps your other settings, but check first if you have organisation-managed settings. `noonsight check` reports which install reaches which directory.
- **Known gaps:**
  - Agents started by a workflow get no rules.
  - Subagents from a plugin noonsight doesn't read (for example one your organisation syncs) are assumed to run on their parent's model.
  - Several foreground subagents of the same type that need different rules get nothing until their first Edit, Write or agent call.
  - A compacted conversation resumed with nothing naming a model runs on Claude Code's default model, and noonsight can't tell which that is.
  - `/fork` doesn't work in sessions started with `noonsight run`.
- **Not measured:** agent teams, routing and the classifier. If you rely on agent teams, test them yourself.
- **What the benchmark can't catch:** it ran against a stand-in for the API, so no real model was involved. It also uses noonsight's own rule-picker as the reference, so it would catch a rule not arriving, but not the wrong rule being chosen.
- **Version churn:** a Claude Code update can quietly change hook behaviour. Most of the nine bugs found so far came from exactly that kind of lifecycle detail.

## What it guarantees

On the Claude Code versions it was checked on (2.1.328 and 2.1.330), within the documented limits, each request a session or subagent sends contains the rules you configured for the model it actually runs on, and no other model's rules unless a note marks them as no longer applying. That claim rests on hook behaviour checked live on those versions and on the fuzzing results against the API stand-in. It is not a guarantee that the model follows the rules.
