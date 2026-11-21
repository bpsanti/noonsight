**Verdict: adopt with conditions.** Run a time-boxed pilot on a few machines first. Don't roll it out to the whole team yet.

**Reasons**

1. **It fixes a gap your setup has.** You run four models and start many subagents. In the project's delivery benchmark, rules placed in a `CLAUDE.md` or `.claude/rules` reached only 32.2% (39 of 121) of subagent requests. They never reach the built-in Explore and Plan subagents, and every model also gets the other models' rules: only about 27–32% of the rule text was written for the model reading it. On the same 60 sessions, noonsight delivered to 100% of requests (`docs/evidence.md` D5–D12). If everyone used one model, a `CLAUDE.md` would be enough; the README says so itself.
2. **The evidence is unusually solid.** Every number links to a raw result file, and `npm test` recomputes each one. The comparisons were fixed before the runs. A fuzzer found four real bugs (F1–F4) and the write-ups report them openly (`experiments/delivery/README.md`).
3. **It's very new.** It's version 0.0.1, isn't published on npm, is installed from a clone with `npm link`, and has one maintainer (`bpsanti`). The entire changelog sits under "Unreleased".
4. **The default rules do little in normal interactive use.** I checked `presets/claude/preset.json`. A watched session with no scope gets these, and nothing else:
   - **Opus and Fable sessions:** nothing.
   - **Sonnet and Haiku sessions:** only `verify-changes`, after the first edit of a tracked code file.
   - **Subagents:** `carry-through` for Sonnet and Haiku, `low-context-report` for Fable, nothing for Opus.
   
   To get real value you have to set scopes, mark unattended sessions, or write your own rules.
5. **What the rules change is measured only on small tasks.** `verify-changes` made Sonnet and Haiku run the tests 29/30 and 27/30 times, against 0/30 without it, but roughly doubled the cost of a cheap fix ($0.024 → $0.0505). On realistic tasks the benchmark pilot found no measurable difference in outcomes, at about 7% more cost per run (CHANGELOG, `experiments/benchmark/results/2026-11-19`).

**Conditions and risks**

- **Pin and recheck Claude Code versions.** It relies on detailed hook behavior verified on Claude Code 2.1.325–2.1.329 (`docs/verification/claude-code.md`). Before each Claude Code upgrade, someone needs to rerun `npm run test:live` and the delivery corpus. One listed fact, that a model reads `additionalContext` from `SessionStart` and can quote it, is marked "Not yet run".
- **Write your own rules.** The preset is a starting point. Use `all_models.add` for team conventions, give each repo a `.noonsight/noonsight.json`, and set `session.unattended_when_env` for CI and orchestrators. Keep rules every model should follow in `CLAUDE.md`.
- **Measure before you scale.** Use `noonsight report` and your own before/after runs, and drop rules that change nothing you can see.
- **Check your login and provider.** Managed settings that forbid user hooks will stop it entirely, and `noonsight check` reports that. Model aliases are only mapped for the Anthropic API.
- **Gaps that were never measured:** `/resume` typed inside a session, forks, plan mode, agent teams, routing, the classifier, and subagents that edit files.
- **Known holes:**
  - Several parallel subagent calls of the same type that would get different rules leave those subagents with only the rules they share.
  - A conversation compacted and then resumed without naming a model can get the wrong model's rules.
  - F3 and F4 are fixed, but the 300-session run hasn't been repeated on the fixed build.
- **Smaller costs:** each hook run takes about 60–120 ms of CPU. Routing in auto mode can cause the other agent calls in the same response to be refused. Routing is off by default; keep it off.
- **It's guidance, not enforcement.** A delivered rule is context the model may ignore. Anything that must never happen belongs in a hook or a permission rule.

**What it guarantees:** It aims to put each model's own rules, and not another model's unless a note retires them, into every request a session or subagent sends. On Claude Code 2.1.328, against a local stand-in for the API, it did this for 99.5% of requests (3 of 300 sessions failed somewhere). That figure rests on that one Claude Code version's hook behavior, on noonsight's own resolver as the reference for which rules are right, and on delivery only, not on whether the model follows the rules.
