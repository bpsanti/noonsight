**Verdict: adopt with conditions.** Start with a time-boxed pilot on a few machines, not a team-wide rollout.

**Reasons**

1. **It fixes a real gap for a team that mixes models and uses subagents.** On the same 60 test sequences, every model's rules in one user `CLAUDE.md` reached 87.3% of requests but only 32.2% of subagent requests. They never reached the built-in Explore and Plan subagents. Only 31.5% of the rule text a model got was written for it. Under noonsight it was 100%, 100% and 79.0% (README, `docs/evidence.md` D5, D6, D9, D10, D12). If you only ran one model with fixed rules, a `CLAUDE.md` would do, as the README itself says.
2. **The evidence behind its claims is unusually strong.** Every number links to a committed raw result, and `test/evidence.test.ts` recomputes it. The fuzzer found nine of its own bugs (F1–F9), and each fix has a stored reproduction that failed before the fix (D24: 8 of 8). The README states its own limits openly.
3. **The hooks are cheap and low-risk by design.** They never block, always exit 0 and use no network. I checked the source: the only processes the hooks start are `git`, `ps`, and `claude` for the classifier, which is off by default. Each hook uses roughly 50–150 ms of CPU (D15). There are no runtime dependencies, and `noonsight uninstall` removes it.
4. **But it is very new.** It is version 0.0.1, unreleased, from what looks like a single author, and the whole changelog spans about ten days (2026-11-14 to 11-23). The latest run is from today. It still changes the format of the decision log, its config keys and its defaults: for example, headless runs now get different rules after an upgrade.
5. **The default preset does little for interactive sessions.** Attended Opus 5.5 and Fable 5.2 sessions get *nothing* from the preset. Attended Sonnet and Haiku sessions get `verify-changes` once they edit a tracked code file, and their other rules only if a scope is set. Most of the value will come from rules you write and maintain yourselves.
6. **The rules' effect on behavior is narrow, and the extra work costs money.** `verify-changes` reliably made Sonnet and Haiku run tests (0/30 → 29/30), but it doubled the cost of a Sonnet fix ($0.0240 → $0.0505, R6). `sonnet-5-5/carry-through` helped on one backlog task, and Haiku's showed nothing. The broader benchmark pilot found runs costing 7% more and no measurable quality difference. These are small tasks with 30–40 runs per arm.

**Conditions and risks**

- **Pin the Claude Code version.** It depends on hook behavior that changes between Claude Code releases, including one environment variable Claude Code does not document (`CLAUDE_CODE_SESSION_ATTENDED`). Everything was measured on 2.1.325–2.1.330 (`docs/verification/claude-code.md`). Rerun `npm run test:live` and `noonsight check` before every Claude Code upgrade, or delivery can break silently. If the team auto-updates Claude Code, this condition probably fails.
- **Install from a reviewed commit, not from npm.** The npm name `noonsight` is only an empty placeholder right now. Pin the git commit and review the diff on each update, because it runs on every session and subagent event.
- **Know that install touches every login.** `noonsight install` writes hooks into *every* Claude Code configuration directory in a user's home. Say so to people before they run it. Repository rules only apply after each person runs `noonsight trust`.
- **Configure it for how you work.** Set `session.unattended_when_env` for orchestrator-run sessions. Decide whether to `enable` the attended rules for Opus and Fable (some cost more, e.g. `code-ownership` raised output tokens by 70–80%). Give sessions a scope where you want scoped rules.
- **Known gaps:**
  - A workflow's agents get nothing.
  - Agent teams, routing and the classifier are not measured.
  - Plugins it can't read, such as ones synced by an organization, make it predict the wrong model for their subagents.
  - `/fork` is refused in sessions started with `noonsight run`.
  - A conversation that was compacted, then resumed with nothing naming a model, can get the wrong rules.
- **Measure it yourselves.** Use `noonsight report` to confirm delivery, but delivery is not obedience. Before keeping a rule, compare cost and outcomes on your own tasks with and without it.
- **Its headline result is slightly generous.** The "0 of 300 sessions" claim for the latest run covers the 299 sessions that actually ran; one was not driven. All of these tests used a local stand-in for the API, not real models.

**What it guarantees:** Each session and subagent gets its own model's rules, and no other model's rules that a note hasn't retired, in the context of every request (the latest run had 100% coverage across 299 sessions). It does not guarantee the model obeys them, and the guarantee rests on Claude Code's hook behavior as checked on versions 2.1.328–2.1.330, measured against a local stand-in for the API rather than real models.
