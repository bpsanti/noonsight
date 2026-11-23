**Verdict: adopt with conditions.** Run it as a pilot on a pinned Claude Code version, not as a team-wide default yet.

**Reasons**

- **It fits how you work.** It's built for teams running several models with many subagents. In its own benchmark, the usual alternatives reached subagents poorly: a user `CLAUDE.md` or `.claude/rules` got rules to 32.2% of subagent requests (39 of 121). It never reaches the built-in Explore and Plan subagents, and it gives every model the other models' rules too. noonsight reached 100% of subagent requests (763 of 763 in the latest run, `docs/evidence.md` D10 and D20).
- **The evidence is unusually careful.** Every number links to a committed raw file, and `npm test` recomputes each one (`docs/evidence.md`). The fuzzer found nine real failures (F1–F9); each has a minimal reproduction that fails before its fix and passes after.
- **It's low-risk to run.** The hooks never block anything. They make no network calls except the optional classifier, which is off by default; the source agrees, since the only processes it starts are `git`, `ps`, `claude` and the service manager. It has no runtime dependencies, adds about 50–90 ms of CPU per hook, and `noonsight uninstall` and `NOONSIGHT_DISABLE=1` let you back out.
- **It's very young.** It's version 0.1 and isn't on npm, so you'd install from a git clone. The fixes for F5–F9 (forks, plan mode, resumes) were committed today, 2026-11-23, and haven't been released (`CHANGELOG.md`, "Unreleased").
- **It depends on Claude Code details that change.** It relies on an undocumented environment variable (`CLAUDE_CODE_SESSION_ATTENDED`), the transcript file layout, reading `--model` from `ps`, and behaviour the author found by reading Claude Code's bundled code (`docs/verification/claude-code.md`). Claude Code went from 2.1.325 to 2.1.330 in about nine days. CI still pins 2.1.325 while the headline evidence was measured on 2.1.330.
- **Out of the box it does little for some of your sessions.** An attended Opus 5.5 or Fable 5.2 session gets nothing from the preset, because those rules ship off. An attended Sonnet or Haiku session gets almost nothing until it has a scope or edits a tracked code file. The measured effects on behaviour come from small tasks (30–40 runs per arm). Some rules cost real money: `verify-changes` roughly doubled the cost of a Sonnet fix ($0.0240 to $0.0505). Haiku's `carry-through` showed no clear effect.

**Conditions and risks**

- **Conditions:**
  - Pin one Claude Code version across the team. Rerun `npm run test:live` and the delivery corpus before each upgrade.
  - Install from a specific commit you've reviewed, since it puts hooks into every session for every login.
  - Set `session.unattended_when_env` to your orchestrator's variable.
  - Decide on attended-session rules: turn some on with `enable`, or write your own.
  - Keep rules every model should have in `CLAUDE.md`.
  - Check `noonsight report` during the pilot, and drop rules that change nothing you can see.
- **Gaps it documents:**
  - A workflow's agents get no rules.
  - Agent teams, routing and the classifier aren't measured.
  - Subagents from a plugin it doesn't read, such as one your organization syncs, get their parent's model's rules.
  - `opusplan` and one resume-after-compact case can get the wrong model.
  - A fork started with `--continue` can pick the wrong original if another session writes its transcript at the same moment.
- **Benchmark limits:** it ran against a stand-in API that gives fixed replies, so no real model behaviour was involved. It checks delivery against noonsight's own resolver, so a wrong resolution wouldn't show up.
- **What could go wrong:** a Claude Code update quietly changes hook behaviour. Rules could then go missing or reach the wrong model, and the decision log could still record them as delivered (F1 was exactly that).
- **Delivery isn't obedience:** a delivered rule is only context, the same as `CLAUDE.md`.

**What it guarantees:** It doesn't promise the model will follow any rule. What it measured is that each session and subagent receives its own model's rules as context: 0 of 300 fuzzed sessions failed and 3,090 of 3,090 requests held their rules. That rests on Claude Code 2.1.330's hook behaviour (some of it undocumented and checked by hand), a benchmark against a stand-in API, and fixes that are one day old.
