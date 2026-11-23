**Verdict: adopt with conditions.** Treat it as a limited pilot, not a team-wide rollout.

**Reasons**

- **It solves a real problem you have.** You use four models and many subagents. A `CLAUDE.md` reaches the main conversation fully (100%, 448 of 448). But it reached only 46.9% of subagent requests (60 of 128), and it never reaches the built-in Explore and Plan subagents. It also gives every model every other model's rules: only 32.6% of the rule text in a request was for that request's model. noonsight measured 100% of subagent requests (763 of 763) and 78.6% of rule text for the right model (`README.md:36-41`, D28/D30).
- **The delivery evidence is unusually careful.** Every number links to a raw result file, and `npm test` recomputes them (`docs/evidence.md`). The benchmark generated 300 random sessions with real interactive Claude Code, going through `/model`, `/compact`, resumes, forks, plan mode and subagents; 299 ran to the end with no violations. It planted three bugs to check the benchmark catches them; it caught every affected session for one, and only about half for the other two.
- **There's no evidence it makes the work better overall.** On public tasks, the paid pilot showed no measurable difference: 133, 132 and 133 passes out of 144 with no rules, with noonsight, and with a `CLAUDE.md` (B1). The measured gains are narrow, on small tasks, with 30–40 runs per setup:
  - `verify-changes` made Sonnet and Haiku run tests after a fix (0 of 30 without it, 29 and 27 of 30 with it), but about doubled the cost ($0.024 to $0.0505).
  - Sonnet's `carry-through` raised fully finished backlog runs from 9 of 40 to 32 of 40.
  - Fable's `low-context-report` shortened sentences in its reports.
  - No preset rule for Opus has a measured effect.
- **The preset does little for your watched sessions on Opus and Fable.** Their rules for attended sessions all ship turned off, so those sessions get nothing until someone turns rules on (`README.md:49-51`). Most of the value depends on writing your own rules and setting scopes.
- **It's very young and tied to one Claude Code version.** Every date in the repo is between 2026-11-14 and 11-23. The benchmark found nine delivery bugs (F1–F9) in that time, five of them from paths added in the last few days. It isn't on npm yet, so you'd install it from a git clone. The delivery claim holds only for Claude Code 2.1.330, and many of the Claude Code behaviours it relies on were last checked on 2.1.325 (`docs/verification/claude-code.md`).

**Conditions and risks**

Conditions:
- Pin Claude Code to the version that was measured. Before each upgrade, rerun the project's corpus (`NOONSIGHT_LIVE_DELIVERY=1 npm run test:live`). It makes no Anthropic API calls (it uses a local stand-in), and it catches changes in how Claude Code handles hooks.
- Install from a reviewed commit, or fork it. It writes hooks into every Claude Code login on your account (or machine-wide with `--managed`), so a bad update affects every session.
- Write the rules that actually differ by model yourselves. Keep shared rules in `CLAUDE.md`. Set `session.unattended_when_env` for unwatched interactive sessions, and use `NOONSIGHT_SCOPE` where you want scoped rules.
- Judge it on results. Use `noonsight report` to confirm delivery, run a small comparison of your own on your rules, and drop rules that change nothing or cost too much.

Risks:
- **Delivery isn't obedience.** A delivered rule is only context.
- **Known gaps:**
  - A workflow's agents get no rules.
  - Some parallel subagent calls get nothing until their first edit, write or agent call.
  - Subagents from a plugin it doesn't read, such as one your organisation syncs, are assumed to run on the parent's model, which may be wrong.
  - `opusplan` can't be handled.
  - `/fork` stops working in sessions started with `noonsight run`.
  - A rare resume-after-compact case runs on the wrong model.
  - Agent teams, routing and the classifier were never measured. If you use agent teams, nothing tells you whether those agents get their rules.
- **It depends on undocumented behaviour.** It treats a session as headless based on an undocumented variable, `CLAUDE_CODE_SESSION_ATTENDED`. If a release drops it, every session silently counts as watched. It also reads the parent `claude` process's command line.
- **Hooks cost time and tokens.** Each hook run takes 80–150 ms of CPU, measured on a heavily loaded laptop, and adds about 1,300 characters per request.
- **Privacy.** If you turn on the optional classifier, it sends the first 4,000 characters of each task to a model through your login.

**What it guarantees:** noonsight promises that each session and subagent gets its own model's rules and no other model's, but that rests on one 300-session benchmark run on Claude Code 2.1.330. That run used a fake API, generated sessions at random, and judged "correct" with noonsight's own rule-picking logic, so it checks delivery, not whether the rules were chosen correctly or what the model does with them.

All of this comes from reading the repo's docs and result summaries. I didn't run `npm test` or the benchmark, and I didn't check the raw result files myself.
