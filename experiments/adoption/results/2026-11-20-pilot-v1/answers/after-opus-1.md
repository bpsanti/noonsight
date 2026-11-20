**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines, not a team-wide rollout yet.

**Reasons**

1. **It fixes a real gap in how you work.** Your team mixes four models and leans on subagents, and that's where the built-in options fail. In the project's delivery benchmark, a `CLAUDE.md` reached only 32.2% (39 of 121) of subagent requests and never reached the Explore and Plan subagents. It also handed each model the other models' rules, so only 31.6% of the rule text a model got was written for it. noonsight covered 121 of 121 subagent requests on the same sequences (`docs/evidence.md` D6–D12, `experiments/delivery/results/.../2026-11-20-4e18c43/README.md`).
2. **The evidence is unusually honest and can be checked.** Every number links to a committed raw file, `npm test` recomputes each one, and comparisons were fixed before the runs. The README states its own failures (3 of 300 sessions broke) and lists what was never measured.
3. **The default rules do nothing for ordinary interactive sessions.** The preset has no rule for a watched session with no task scope (`docs/install.md:29`, README line 39). Unless people set `NOONSIGHT_SCOPE` or mark runs as unattended, the benefit is limited to subagents, unattended runs and the `verify-changes` rule that switches on after a code edit.
4. **No measured gain in task outcomes yet.** In 588 paid runs, tasks resolved were 132 of 144 with noonsight against 133 without, and runs cost about 7% more (`experiments/benchmark/results/2026-11-19/summary.md`). The only clear behaviour changes are narrow:
   - With `verify-changes`, Sonnet and Haiku ran the tests after a small fix in 30/30 and 27/30 runs, against 0/30 without (R1).
   - Sonnet's `carry-through` rule raised fully completed 13-ticket backlogs from 9/40 to 32/40 (R10).
   - Every run passed its hidden check with or without rules (R8).
5. **It's very young.** All the dated work falls between 2026-11-14 and today, it's version 0.1 and has one maintainer. It isn't on npm yet; the name there holds only a placeholder. The fixes for two of the three failures found (F3 and F4) are in "Unreleased", and the full 300-session run hasn't been repeated on the fixed build.

**Conditions and risks**

- **Pin the Claude Code version.** The headline 99.5% was measured on 2.1.328 only, and parts of the hook behaviour it depends on were checked on 2.1.325–2.1.327 (`docs/verification/claude-code.md`). Version 2.1.329 was already out when the run happened. Before any upgrade, run the delivery corpus (`npm run delivery -- corpus`) on the new version.
- **Install from a reviewed clone at a pinned commit.** Don't use `npx noonsight` until a real release exists, because the npm name is currently a placeholder.
- **Decide on scopes up front.** Either people set `NOONSIGHT_SCOPE` or you set `session.unattended_when_env` for automation. Otherwise most main sessions get nothing.
- **Keep the classifier and routing off at first** (both are off by default):
  - The classifier sends the first 4,000 characters of a task to a model.
  - Routing rewrites agent calls. In auto mode, a rewritten call makes Claude Code refuse the other calls in the same response until Claude makes them again.
- **Check your managed settings.** Install writes hooks into every Claude Code config directory under your home. If your organisation sets `allowManagedHooksOnly` or `disableAllHooks`, those hooks are blocked; run `noonsight check` to find out.
- **Known gaps:**
  - Never measured: `/resume` typed inside a session, forks, plan mode, agent teams, and subagents that edit files.
  - Plugin subagents and agent-team members get no rules or a wrong guess at their model.
  - Several parallel agent calls of the same type that would need different rules leave those subagents with none.
  - After a compaction with no reply since, a resume that doesn't name a model runs on Claude Code's default model, which noonsight can't detect.
- **Overhead:** each hook takes about 60–120 ms of CPU time, and each request carries about 1,150 more characters.
- **Measure it during the pilot.** Use `noonsight report` together with your own outcome data. Drop any rule that changes nothing you can see.

**What it guarantees:** Only that each model's own rules are in the request it receives (99.5% of requests in the benchmark), not that the model follows them or that results improve; this rests on Claude Code 2.1.328's hook behaviour, a local stand-in for the API with scripted answers, and noonsight's own resolver as the reference for which rules count as "right".
