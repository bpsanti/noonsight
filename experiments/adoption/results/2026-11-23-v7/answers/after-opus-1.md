**Verdict: adopt with conditions.** Run it as a time-limited pilot on a few machines first, not a team-wide rollout.

**Reasons**

- **It fills a real gap.** On the tool's own benchmark, a user `CLAUDE.md` reached every request in the main conversation (526 of 526, D17). But it reached only 32.2% of subagent requests (D10), and it never reaches the built-in Explore and Plan subagents. You use subagents heavily, and noonsight covered 100% of subagent requests (763 of 763 on Claude Code 2.1.330, D20).
- **It sends each model only its own rules.** With one `CLAUDE.md`, every model also reads the other three models' rules: only 31.5% of the rule text in a request was written for that model, against 79.0% under noonsight (D12). It also adds less text per request: 1,155 characters against 4,415 (D13). That matters for a team running four models.
- **The evidence can be checked.** Every number in `docs/evidence.md` points to a committed raw file, and `npm test` recomputes it. The fuzzer found nine bugs (F1–F9); each has a reproduction in the corpus. The known limits are listed in the README rather than hidden.
- **Low operational risk.** It has no runtime dependencies. The hooks always exit 0, never block or deny a call, never use the network (unless you turn on the optional classifier), and take about 50–90 ms (D15). `noonsight uninstall` and `NOONSIGHT_DISABLE=1` give clean ways out.
- **Why conditions and not plain adopt:**
  - The newest fixes (F5–F9, for forks, plan mode and `/resume`) are in "Unreleased", measured today (2026-11-23).
  - Version 0.1 isn't on npm, so you install from a clone.
  - CI pins Claude Code 2.1.325, but the headline results were measured on 2.1.328 and 2.1.330.

**Conditions and risks**

- **Pin the Claude Code version.** It depends on hook behaviour Claude Code doesn't fully document. For example, `CLAUDE_CODE_SESSION_ATTENDED` is undocumented, and if it changes, every session is treated as attended. Pin a version noonsight was verified on (2.1.330) and re-run `npm run test:live` before each upgrade. `docs/verification/claude-code.md` lists what to recheck.
- **Pin a reviewed commit.** Install from a commit you've reviewed, since there's no published package. Note that `noonsight install` writes hooks into the `settings.json` of every Claude Code login on your account.
- **Opus and Fable get nothing by default.** In attended sessions, their preset rules all ship off. Turn on the ones you want with `enable`, or write your own rules.
- **Sonnet and Haiku need a scope.** Most of their preset rules only apply when a session has a scope, so set `NOONSIGHT_SCOPE` or define `match` patterns.
- **Mark unwatched sessions.** For interactive sessions nobody watches, such as orchestrators, set `session.unattended_when_env`.
- **Your setup may hit gaps that weren't measured or don't work:**
  - Agent teams, routing and the classifier were never measured.
  - A workflow's agents get no rules at all.
  - Plugins your organization syncs aren't read, so their subagents can get the parent model's rules.
  - The `opusplan` model setting isn't supported.
  - One compact-then-resume case can deliver the wrong model's rules.
  - `/fork` doesn't work in sessions started with `noonsight run`.
- **The benchmark has limits.** It used a stub API that gives fixed answers, so it says nothing about real models' traffic patterns. It also checks delivery against noonsight's own resolver, so a wrong resolution wouldn't show up.
- **Measure whether the rules help.** Rule effects were measured on small tasks (30–40 runs per arm), with none for Opus 5.5, and Haiku's `carry-through` showed nothing (R11). Use `noonsight report` and your own comparisons to drop rules that don't change anything. Rules also add cost: `verify-changes` roughly doubled the cost of a Sonnet fix run, from $0.024 to $0.0505 (R6).

**What it guarantees:** It guarantees only that each session and subagent receives, as context, the rules configured for the model it actually runs on. That rests on Claude Code's hook behaviour as checked on specific versions (up to 2.1.330) and on a stub-API benchmark (0 of 299 sessions failing); it does not guarantee that the model follows the rules.
