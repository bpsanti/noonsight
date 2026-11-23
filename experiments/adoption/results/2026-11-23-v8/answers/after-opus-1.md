**Verdict: adopt with conditions.** Start with a time-boxed pilot on a few machines rather than rolling it out to everyone.

I read the README, `docs/hooks.md`, `docs/evidence.md`, `docs/install.md` (via search), the delivery benchmark's README and its current result, and the changelog. I did not run its tests or benchmarks, so every number below is the project's own reported result, not something I checked.

## Reasons

1. **It solves a problem your setup actually has.** You mix models and use many subagents. The project's numbers show the usual ways of giving Claude rules fall short there:
   - A `CLAUDE.md` reached only 46.9% of subagent requests (60 of 128), and never reaches the built-in Explore and Plan subagents (D28). Claude Code's own docs confirm the Explore/Plan gap.
   - A `CLAUDE.md` also gives each model every other model's rules. Only 32.6% of the rule text in a request was meant for that request's model (D30), and 619 requests held another model's rules with nothing telling the model to ignore them (D32).
   - noonsight reported 100% of subagent requests covered (763 of 763), 78.6% of rule text meant for the right model, and no requests with another model's rules left standing.
2. **The evidence is unusually careful.** Every number traces to a committed raw file, and `npm test` recomputes each one. Old results are marked as replaced rather than quietly edited. The limits are written down. The project also published its own failures: nine (F1–F9), each with a shortest reproduction that now passes.
3. **Low security and operational risk.** The hooks never block anything and never deny a call. They read only local files and make no network calls, except an optional classifier that is off by default. It has no runtime dependencies, and `NOONSIGHT_DISABLE=1` or `noonsight uninstall` turns it off.
4. **But the starter rules ("the preset") do little measurable on their own.**
   - In a paid trial on public tasks, pass rates were the same with no rules, with noonsight and with a `CLAUDE.md` (133, 132 and 133 of 144), while cost went up from $0.145 to $0.155 per run (B1, B2).
   - No Opus 5.5 rule has a measured effect.
   - All of Opus's and Fable's rules for watched (interactive) sessions are off by default, so your interactive Opus and Fable sessions get nothing until you turn one on.
   - Measured effects exist only for `verify-changes` (Sonnet and Haiku), `carry-through` (Sonnet) and Fable's `low-context-report`, all on small tasks. `verify-changes` roughly doubles the cost of a small fix ($0.024 to $0.0505).
   
   So the value depends on your team having rules that really should differ by model.
5. **It is young.** It's version 0.1, not on npm, installed from a git clone, and has one maintainer (it was renamed from "sextant"). F5 to F9 were found and fixed in the four days before the current benchmark run.

## Conditions and risks

**What would have to hold:**
- **You have rules that should differ by model, or that subagents (Explore and Plan especially) need.** If you don't, a `CLAUDE.md` is simpler, and the README itself says so.
- **You pin and check Claude Code versions.** The delivery results were measured only on Claude Code 2.1.330. Several things it relies on are undocumented Claude Code internals: `CLAUDE_CODE_SESSION_ATTENDED`, `forkedFrom` in transcripts, the background job's `state.json`, and the subagent metadata's `toolUseId`. Hook behaviour changes between Claude Code releases. Re-run its test set (`npm run delivery -- corpus`, needs no login) on each new Claude Code version before people upgrade, or accept that delivery may quietly degrade.
- **Each person installs it themselves.** If your organization pushes settings from the claude.ai admin console (Team/Enterprise), Claude Code ignores the machine-wide install, so each person needs the per-account install instead. Each person also runs `noonsight trust` once in every repository that has a shared noonsight config.
- **Interactive sessions nobody watches are flagged.** For those, set `session.unattended_when_env` to your orchestrator's or CI's variable, or they get the rules for watched sessions. Give Sonnet and Haiku sessions a task category ("scope", e.g. `NOONSIGHT_SCOPE=build`) if you want their scoped rules.
- **You check that it's working.** Use `noonsight report` and drop rules that change nothing visible.

**What could go wrong:**
- A Claude Code update breaks delivery silently. The log records what the hook handed to Claude Code, not what the model actually received.
- These cases are outside the guarantee:
  - Workflow agents get nothing.
  - Agent teams, model routing and the classifier were never measured.
  - Subagents from plugins it doesn't read (such as organization-synced ones) get rules for the wrong model.
  - Several same-type subagents started together that need different rules get nothing until their first edit or agent call.
  - `/fork` doesn't work in sessions started with `noonsight run`.
  - On a fork via `--continue`, another session writing at the same moment can be mistaken for the original conversation.
  - After a compaction with no reply since, resuming without naming a model runs on Claude Code's default model, which noonsight can't tell.
- Each hook run costs about 80–150 ms of CPU on a busy machine, and a subagent's start can wait up to 2 s more.
- Paid-for rules can add cost with no gain in results.
- It depends on one maintainer of a pre-release tool.

## What it guarantees

It guarantees only that each session and subagent is handed the rules written for its current model, not that the model follows them. That rests on a single benchmark run: 299 scripted sessions of real Claude Code 2.1.330 talking to a local stand-in for the API, so no model ever answered. Correctness was judged against noonsight's own rule-picker, so if it picked the wrong rules, the benchmark would not catch it.
