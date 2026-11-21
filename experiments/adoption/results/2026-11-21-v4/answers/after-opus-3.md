**Verdict: adopt with conditions.** Start with a time-limited pilot on a few machines, using rules you write yourselves, and put Claude Code version pinning in place first.

**Reasons**

1. **It fits how you work.** Your team mixes Opus, Sonnet, Haiku and Fable and uses subagents heavily. The tool's own README says to skip it when every session runs one model with fixed rules (`README.md:189`). You are the case it's built for.
2. **The native options miss subagents.** On the same 60 test sessions, the native ways of shipping rules mostly failed to reach subagents:
   - a user `CLAUDE.md` reached 32.2% of subagent requests (39 of 121), `.claude/rules` the same, and skills 0%.
   - noonsight reached 100% (`docs/evidence.md` D9–D11).
   - `CLAUDE.md` never reaches the built-in Explore and Plan subagents.
   
   If your rules matter inside subagents, this is the main gap it fills.
3. **It sends each model only its own rules.** With `CLAUDE.md`, only 31.5% of the rule text in a request was meant for the model reading it. Under noonsight it was 79.0%, and it added about 1,155 characters per request against 4,415 for `CLAUDE.md` (D12, D13). That matters because the per-model guides give different advice.
4. **The evidence is unusually careful.** Every number links to a raw result file that `npm test` recomputes. The test plans were fixed before the runs. A fuzzer found four real bugs (F1–F4), which were fixed and turned into regression cases. The one remaining failure (1 of 300 sessions) is a documented limit (`experiments/delivery/results/.../2026-11-21-d5fd71f/README.md`).
5. **Low operational risk.** The hooks never block anything and don't use the network (the optional classifier is the exception). They take about 50–90 ms of processor time per run, have no runtime dependencies, and can be switched off per session with `NOONSIGHT_DISABLE=1` or removed with `noonsight uninstall`.
6. **Why not a plain "adopt":**
   - It's pre-release: `package.json` is at 0.0.1, it isn't on npm, and you install from a clone of one person's GitHub repo.
   - The delivery results come from a single Claude Code version, 2.1.328.
   - It relies on one environment variable Claude Code doesn't document (`CLAUDE_CODE_SESSION_ATTENDED`) to tell interactive sessions from unattended runs (`docs/verification/claude-code.md:34`).

**Conditions and risks**

*What has to hold:*
- **Pin your Claude Code version** and rerun the project's checks (`npm run test:live`, plus the delivery corpus) before every upgrade. The tool depends on hook behaviour Claude Code is free to change, and the docs list each fact it relies on with the version it was checked on.
- **Write your own rules.** The preset delivers almost nothing to the interactive sessions you watch (README:44–48):
  - watched Opus and Fable sessions get nothing at all;
  - watched Sonnet and Haiku sessions get one rule, `verify-changes`, after their first edit of a tracked code file, and their other rules only when you set a scope (`NOONSIGHT_SCOPE`).
  
  Without your own rules or scopes, it mostly affects headless runs and subagents.
- **Measure what the rules do.** The tool guarantees that text arrives, not that the model follows it. The effect data covers small tasks with 30–40 runs each, and the results are mixed:
  - Sonnet's `carry-through` lifted complete runs on a 13-ticket backlog from 9 of 40 to 32 of 40;
  - Haiku's `carry-through` showed no effect;
  - `verify-changes` roughly doubled Sonnet's cost per run, from $0.024 to $0.0505.
  
  Use `noonsight report` and drop rules that change nothing you can see.
- **Review the code before installing.** `noonsight install` writes hooks into every Claude Code login's `settings.json`, and these hooks run on every session start, model switch, edit and subagent call.
- **Keep the classifier off,** or decide deliberately to allow it. It's the one feature that sends task text (the first 4,000 characters) to a model.

*What could go wrong:*
- **Untested paths.** These were never measured: `/resume` inside a session, forks, plan mode, agent teams, routing, the classifier, per-repository configs, and subagents that edit files. Agent-team teammates and workflow agents get no rules at all (`docs/hooks.md:320`).
- **Parallel subagents can miss rules.** If one response starts several subagents of the same type that need different rules, they get none. A subagent held on a permission prompt for more than about 5 seconds also gets none (`docs/hooks.md:256, 266`).
- **Routing in auto mode has a side effect.** If you turn routing on, other agent calls in the same response are refused and have to be made again (`docs/hooks.md:309`).
- **The log can overstate delivery.** `decisions.jsonl` records what the hook returned, not what reached the model. In the benchmark the log said 100% where the requests actually showed 99.9%.
- **Single maintainer, early stage.** Expect breaking changes; it was already renamed once, from "sextant".

**What it guarantees:** It guarantees that each session and each subagent receives the rules for the model it actually runs on, and gets them again when that model changes. That rests on one benchmark: 99.9% of requests (3,219 of 3,221) and 100% of subagent requests across 300 random sessions, on Claude Code 2.1.328, with the preset's rules from the machine's configuration, against a local stand-in for the API rather than real models. It does not guarantee that the model follows the rules, or that delivery holds on other Claude Code versions or on the untested paths above.
