**Verdict: adopt with conditions.** Run it as a pilot on a few machines with a pinned Claude Code version, not as a team-wide rollout yet.

I read the README, docs, preset, changelog and committed delivery results, and checked the headline delivery numbers against the raw `summary.json`. I could not run `npm test` or the tool itself in this session, so nothing here is confirmed by execution.

## Reasons

- **Your setup is the case it is built for.** It gives each session and each subagent only the rules for the model it runs on, and re-delivers them after `/model`, `/compact`, `/clear` and resumes. The README itself says a `CLAUDE.md` is simpler if every session runs one model.
- **The subagent gap it closes is real.** On the same 60 test sessions, a user `CLAUDE.md` reached 32.2% of subagent requests (39 of 121) and noonsight 100%. A `CLAUDE.md` never reaches the built-in Explore and Plan subagents.
- **`CLAUDE.md` is already fine for the main conversation.** It covered 100% (527 of 527) of main-conversation requests. The gain there is only that models stop reading each other's rules: 78.8% of rule text was the model's own under noonsight, against 31.6%.
- **Out of the box it does little for your Opus and Fable sessions.** Every preset rule that ships on for those two is for unattended runs or subagents, so a watched session on either receives nothing. Sonnet and Haiku sessions with no scope get only `verify-changes`, after their first edit of a tracked code file.
- **The evidence that rules change outcomes is narrow.**
  - `verify-changes` made Sonnet and Haiku run tests after a small fix in 29 and 27 of 30 runs, against 0 without. It roughly doubled that task's cost on Sonnet ($0.0240 to $0.0505).
  - Sonnet's `carry-through` raised full completion on one backlog task from 9 to 32 of 40. Haiku's showed nothing.
  - Every run passed its hidden check with or without rules.
  - The changelog reports that the SWE-bench-style pilot saw no measurable difference in verifier results, at about 7% more cost.
- **It is low-risk to try.** The docs say the hooks always exit 0, never block a call and read only local files; the only network path is the optional classifier, which is off by default. `noonsight uninstall` removes the hooks, and there are no runtime dependencies.
- **It is very young.** It is version 0.0.1, marked private, not on npm (you install from a clone with `npm link`), and all the work is dated within about a week. The fuzzer found four delivery bugs in two days, and the fixes for the last two have no committed run behind them.
- **The author is unusually honest about limits.** Every number traces to a committed raw file, failures are documented, and the comparisons were fixed before the runs. That makes the claims easier to trust, but it is still one author's own benchmark.

## Conditions and risks

Conditions for it to work for you:

1. **Pin Claude Code.** The delivery results are for 2.1.328 only, and CI pins 2.1.325. Re-run the delivery corpus (`npm run delivery -- corpus`, no login or tokens needed) before each Claude Code upgrade.
2. **Configure it; do not rely on the preset.** Set `session.unattended_when_env` for CI or orchestrator runs, give sessions a scope, and add your own per-model rules, or most sessions receive nothing.
3. **Keep model-independent rules in `CLAUDE.md`.** Use noonsight only for what differs by model, task or place.
4. **Measure on your own tasks.** Use `noonsight report` and drop rules that change nothing you can see.
5. **Check your environment.** It needs Node 20+, and user hooks must be allowed: managed settings with `allowManagedHooksOnly` or `disableAllHooks` stop it. The machine-wide install does not support Windows.
6. **Plan the rollout per person.** Each person runs `noonsight install`, and `noonsight trust` once per repository that commits rules.

What could go wrong:

- **Hook behaviour changes.** It depends on details such as which model a resumed conversation runs on, which already shifted between versions and caused bugs F2 and F4.
- **Parallel subagents can get nothing.** Several open calls of one subagent type that would get different models' rules receive no rules. A call held more than about 5 seconds on a permission prompt can also miss its rules.
- **Some subagents are not covered or are mispredicted.** Agent-team teammates and workflow agents get nothing. Plugin, `--agents` and managed subagent definitions are not read, so the model is guessed and a mismatch is only reported afterwards.
- **A known unfixable limit.** A conversation compacted and then resumed with nothing naming a model runs on Claude Code's default, which noonsight cannot tell.
- **Much is unmeasured.** That includes `/resume` inside a session, forks, plan mode, `noonsight run`, routing, the classifier, project configurations and subagents that edit files.
- **The log can overstate delivery.** It records what the hook returned, not what reached the model: in the benchmark the log showed 100% where the stub saw 99.4%.
- **Cost.** Each hook run takes 60–120 ms of processor time, each request gains about 1,150 characters, and rules that do change behaviour add work.
- **Bus factor.** It is a single-author project that was renamed once already (from sextant).

## What it guarantees

It guarantees delivery, not obedience: in one seeded run of 300 random sessions on Claude Code 2.1.328, 99.5% of requests with rules due (3,199 of 3,216) held their model's rules and 3 sessions failed. That rests on a local stand-in for the API rather than real models, on noonsight's own resolver as the reference, on a build from before the last two fixes, and on Claude Code hook behaviour that can change between versions.
