**Verdict: adopt with conditions.** Pilot it for a few weeks on Sonnet and Haiku sessions and on subagents. Judge it on the rules your team actually writes, not on the preset.

**Reasons**

- **Your setup is what it is built for.** You run four models, and many sessions start subagents. A subagent never sees the parent's conversation. It can also run on a different model than the session. noonsight predicts the subagent's model, delivers that model's rules when the subagent starts, then checks the result (`docs/hooks.md`, Subagents).
- **Delivery is measured, not just claimed.**
  - In the 2026-11-23 run on Claude Code 2.1.330, 0 of 299 sessions broke the invariant (D18).
  - 3,090 of 3,090 requests held their model's rules (D19).
  - 763 of 763 subagent requests held them (D20).
  - Those sessions were real interactive Claude Code, with only the API stubbed. They covered `/model`, `/compact`, `/clear`, resume, forks and plan mode.
- **The native alternatives do worse where you need them most.** Without noonsight on the same sequences, a user `CLAUDE.md` reached 46.9% of subagent requests (D28), and per-model `.claude/rules` reached 76.3% of all requests (D26). A skill per model reached 0% (D27). `CLAUDE.md` and `.claude/rules` also put the other models' rules in front of every model, so only 32.6% and 27.9% of the rule text in a request was written for its model (D30). Under noonsight the share was 78.6%.
- **It is cheap and safe to run.**
  - Hooks always exit 0 and never block or deny anything.
  - They read only local files. The one network feature is the classifier, which is off by default.
  - A bad configuration is refused whole, with a warning.
  - Each hook costs about 80 to 150 ms of CPU on a loaded laptop (D33).
  - Every decision is logged, and `NOONSIGHT_DISABLE=1` turns it off.
- **The project reports its own failures.** It found and fixed nine of its own failures, F1 to F9, and keeps each as a regression test. Every number in the README is recomputed from the raw result files by `npm test`.

**Conditions and risks**

- **Delivery is not obedience.** The README says so. Measured effects are narrow and come from small tasks:
  - `verify-changes` took Sonnet's test runs on the fix from 0 of 30 to 29 of 30 (R3 against R14).
  - `carry-through` took Sonnet's completion of the backlog from 9 of 40 to 32 of 40 (R10).
  - Fable's `low-context-report` shortened sentences (R9).
  - Opus's preset rules have no measured effect.
  - A paid pilot on public tasks found no difference in pass rate: 133, 132 and 133 of 144 for no rules, noonsight and `CLAUDE.md` (B1).
  - If you want better results rather than reliable delivery, you must write and measure your own rules.
- **Check what Opus and Fable actually get.** Their attended-session rules ship off, so an attended Opus or Fable session gets nothing from the preset until you use `enable`. Their on-by-default rules are for unattended runs and subagents only. Sonnet and Haiku scoped rules need `NOONSIGHT_SCOPE`. Set `session.unattended_when_env` for any interactive sessions nobody watches. Run `noonsight install` and `noonsight report` early to confirm what each model receives.
- **Rules cost tokens.**
  - On Sonnet, `verify-changes` roughly doubled the mean cost on the fix, from $0.0240 to $0.0505 (R6).
  - On the backlog, `carry-through` cost about the same as no rules ($0.2848 against $0.2920, R18).
  - Delivery adds about 1,343 characters per request (D31).
  - Decide per rule whether the behavior is worth that cost.
- **It depends on undocumented Claude Code behavior.**
  - Forks, `ps` parsing on macOS, subagent metadata and plan-mode model substitution are not documented by Claude Code. The README says each result holds only for the version it ran on.
  - Every claim was verified on 2.1.325 to 2.1.330. Pin your Claude Code version, or rerun `npm run delivery -- corpus` on each upgrade. Otherwise a Claude Code update can silently break delivery.
- **Known gaps that matter to you:**
  - Workflow agents get nothing.
  - Foreground subagent calls of one type that need different rules get nothing until their first Edit, Write or agent call.
  - Plugin subagents from plugins noonsight does not read are predicted on the parent's model.
  - Agent-team split panes, routing and the classifier are unmeasured. Don't turn on routing or the classifier without testing them.
  - `/fork` is unavailable in `noonsight run` sessions that have rules.
  - Sessions started on the default model, or on `opusplan`, can't be identified.
- **The evidence has limits.**
  - The delivery oracle is noonsight's own resolver. A wrong resolution would not show up as a failure.
  - The stub never decides anything.
  - Rule-effect tasks are tiny.
  - I read the documentation and committed results. I did not run the tests or the benchmark myself.
- **Operational risks:**
  - The project is young (the 0.1.0 log example, and it was renamed from sextant).
  - Repository-level `.noonsight/noonsight.json` files require each person to run `noonsight trust`.
  - If the plugin and a machine-wide install both run, they deduplicate. An older copy without the claim logic delivers twice.
  - Use `npm install -g` rather than `npx`. A cleared npm cache stops delivery silently.

**What it guarantees:** It guarantees that, through Claude Code's hooks, the rules you declare for a model are put into the requests of every session and subagent running on that model, and again after a model change, compact, clear, resume or fork. The guarantee rests on a delivery benchmark of real Claude Code sessions against a stubbed API. It covers delivery on Claude Code 2.1.330 only, not whether the model follows the rules.
