**Verdict:** Adopt with conditions.

**Reasons:**
- **It fits how you work.** Your team mixes Opus, Sonnet, Haiku and Fable and uses many subagents. The only alternative that carries per-model rules is a `CLAUDE.md`, and it fails in two ways.
  - A `CLAUDE.md` never reaches the built-in Explore and Plan subagents. In the benchmark it covered 32.2% of subagent requests (39 of 121, D10), against 100% for noonsight on the same 60 sequences (D9).
  - It also gives every model every other model's rules. Only 31.6% of the rule text in a request was written for that request's model, against 78.8% under noonsight (D12).
  - `.claude/rules` covered 70.9% of requests and a skill per model covered 0% (D7, D8).
- **Delivery is well tested.**
  - The 300 random sessions covered `/model`, `/compact`, `/clear`, resume, subagents and edits. 99.5% of requests with rules due held them (D2), and 667 of 668 subagent requests did (D3).
  - The authors found four of their own bugs (F1–F4), fixed them and kept shortest reproductions as regression tests. Planted faults also check that the fuzzer catches failures.
  - Every number in the README links to a raw result file, and `npm test` recomputes it (`docs/evidence.md`).
- **The hooks are low-risk.** They never block anything and use no network. The exception is an optional classifier that is off by default. Each hook run takes 60–120 ms of CPU (D15). `noonsight uninstall` and `NOONSIGHT_DISABLE=1` undo it. There are no runtime dependencies, and it is MIT licensed.
- **Some rules measurably change behaviour.**
  - `verify-changes` raised "ran the tests after the last edit" from 0 of 30 to 30 of 30 for Sonnet, and from 0 of 30 to 27 of 30 for Haiku (R1).
  - Sonnet's `carry-through` raised complete backlog runs from 9 of 40 to 32 of 40 (R10).
  - Fable's report rule shortened its sentences (R9).
- **It handles silent model switches.** In 20 of 21 runs on one task, Claude Code switched models by itself. noonsight noticed and retired the old rules, while a `CLAUDE.md` left them in place unnoticed.

**Conditions and risks:**
- **You need a task scope or an unattended signal.** Without a scope, the preset delivers little to a watched session. You would have to set `NOONSIGHT_SCOPE` or `session.unattended_when_env` and keep them consistent across the team. Plan on `noonsight check` and `noonsight report` to confirm rules arrive.
- **It must be installable where you work.** It needs user hooks, so managed settings that forbid them would block it. It is also not on npm yet, so you would install from a git clone.
- **It is tied to the Claude Code version.**
  - The benchmark ran on 2.1.328, and some rule experiments on 2.1.329. Claude Code hook behaviour has shifted between versions, and two of the four failures came from resume and switch quirks.
  - Pin the Claude Code version and rerun `npm run test:live` and the corpus on every upgrade.
  - It is a young, single-maintainer-looking project that has changed a lot in the last few days (the commits are dated 2026-11-19 and 11-20), so expect churn.
- **The headline rate is stale.** The 99.5% figure is from before the F3 and F4 fixes, and the 300 sessions have not been rerun on the fixed build. The reproductions pass, but the rate is unconfirmed.
- **Known gaps.**
  - The delivery benchmark did not measure `/resume` inside a session, forks, plan mode, agent teams, `noonsight run`, routing, project configs, or subagents that edit files.
  - A conversation compacted with no response since and resumed without a model name runs on the default model, which noonsight cannot tell. This is the documented limit.
- **Rules cost something.**
  - They add about 1,154 characters per request (D13). Sonnet's cost per run on the fix task rose from $0.0240 to $0.0378 with the preset rules (R6).
  - Where models already do the work, the rules change nothing (R13).
  - Effects were shown on small tasks with 30–40 runs per arm. On the 21-task SWE-bench and Terminal-Bench pilot there was no measurable outcome difference. Haiku's `carry-through` did nothing (R11). Keep only rules you can see working.
- **Other limits.** Experiments ran at `medium` effort and the judge was uncalibrated.
- **Mixed model-switching.** Native and noonsight rules on the same project would duplicate text. Decide up front which rules live in `CLAUDE.md` (the same for every model) and which live in noonsight.
- **Pilot first.** Run it for a couple of weeks on a few developers' machines, and check `noonsight report` for rules that are enabled but never delivered.

**What it guarantees:** It guarantees that the rules written for the model a request runs on are present in that request, and other models' rules only alongside a note that retires them, as measured on Claude Code 2.1.328 against a local stand-in for the API, where it held for 99.5% of requests. It does not guarantee that the model follows the rules. That result rests on a fuzzer-driven benchmark of real interactive sessions, checked by a resolver that noonsight itself provides.
