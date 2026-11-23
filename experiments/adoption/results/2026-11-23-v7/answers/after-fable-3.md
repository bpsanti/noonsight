**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines with rules you write yourselves; do not roll it out team-wide yet.

I read the README, the evidence map, the hooks and install docs, the benchmark results and the changelog, and grepped the source. I had no shell, so I did not run the test suite or recompute any number.

## Reasons

- **It fits your setup.** It targets teams that mix models and start subagents; its own README says a `CLAUDE.md` is simpler if every session runs one model.
- **Its real advantage over `CLAUDE.md` is subagents.** In its benchmark a user `CLAUDE.md` reached 100% of the main conversation's requests (526 of 526) but only 32.2% of subagent requests (39 of 121), and never the built-in Explore and Plan subagents. noonsight reached 100% of both on the same sequences.
- **It keeps other models' rules out.** Under noonsight 79% of the rule text in a request was written for that request's model, against 31.5% with one `CLAUDE.md` holding every model's rules.
- **No outcome benefit is shown.** Its own 588-run pilot resolved 133 of 144 tasks without rules and 132 of 144 with noonsight, at about 7% more cost per run. The README does not mention this result.
- **Rule effects are narrow, and absent for Opus.** The measured effects are on small tasks with 30–40 runs per arm: Sonnet and Haiku ran tests after a fix in 29 and 27 of 30 runs against 0 of 30 without the rule. Nothing is measured for Opus, and Haiku's `carry-through` showed no effect.
- **The default install does little for you.** Attended Opus and Fable sessions receive nothing from the preset. By default, subagents get only `carry-through` (Sonnet, Haiku) and `low-context-report` (Fable), because the preset's scopes have no match patterns.
- **It is pre-release.** `package.json` says 0.0.1 and private, it is not on npm, you install from a clone with `npm link`, and the current changes are still "Unreleased".
- **It is tightly coupled to Claude Code internals.** The delivery fuzzer found nine failures (F1–F9) in about a week, most from Claude Code behaviour on resume, fork and plan mode. Several fixes rely on undocumented fields, as the docs themselves say.
- **The engineering is careful.** It has no runtime dependencies, and my grep of `src` found no network code. Per the docs, hooks always exit 0 and never block a call, repository rules need an explicit `noonsight trust`, and `noonsight uninstall` removes only its own entries.

## Conditions and risks

Conditions:
- **Write your own rules.** Put only what differs by model or place in noonsight and leave shared rules in `CLAUDE.md`.
- **Pin the Claude Code version for the pilot.** Results are measured on 2.1.328 and 2.1.330, and CI's live job runs 2.1.325. Rerun `noonsight check` and the delivery corpus after each upgrade.
- **Review the logs weekly.** Check `noonsight report` for rules never delivered and for `MISMATCH` and `calls-differ` lines.
- **Measure an outcome you care about.** Compare something like tests run after edits, or tasks completed, with and without it. If nothing moves by the end of the pilot, drop it.
- **Check your organisation's managed settings.** `allowManagedHooksOnly` or `disableAllHooks` stops the per-account install from running.
- **Review any committed `.noonsight/noonsight.json` like code.** Once trusted, it injects instructions into every session in that repository.

Risks:
- **Silent failure.** Because hooks never block, a break shows only as a warning or a log line. If the clone or Node.js moves, the hook exits quietly.
- **Subagent gaps that matter to you:**
  - Workflow agents get nothing.
  - Parallel foreground subagents of one type that need different rules get nothing until their first Edit, Write or agent call, so read-only ones never do.
  - Subagents from organisation-synced plugins are predicted on the parent's model.
  - Agent teams in split panes are unchecked.
- **Model fallback.** In the pilot, Claude Code switched models by itself (Fable and Opus to Opus 4.8, Sonnet to Sonnet 5) in 20 of 21 runs of one task. The fallback models are not in the preset, so those sessions end up with only a note that the earlier rules no longer apply.
- **Cost.** `verify-changes` alone roughly doubled the cost of a small Sonnet fix ($0.024 to $0.0505). Each hook run adds 50–90 ms of processor time, on every Edit, Write and agent call.
- **Footprint.** It adds seven hook entries to every Claude Code login's `settings.json`. The machine-wide install is not supported on Windows.
- **Scopes.** Subagent scopes need match patterns you write, or the classifier, which sends the first 4,000 characters of each task to a model.

## What it guarantees

noonsight guarantees delivery, not obedience: each session and subagent receives the rules configured for the model it runs on. That rests on about 600 fuzzed sessions against a stub API on two Claude Code versions (0 of 299 broken in the latest run), checked against its own resolver, with the listed limits excluded.
