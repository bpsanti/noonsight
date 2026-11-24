**Verdict:** Adopt with conditions. Start as a pilot, not a team-wide rollout.

I read the README, `docs/evidence.md` and `docs/hooks.md`. I did not run `npm test` or any experiment, so every number below is the project's own claim as it documents it.

**Reasons**
- **It fits your setup.** You run several models and start many subagents. The tool's one job is to give each session and each subagent the rules written for the model it actually runs on. It does this through Claude Code's hooks, and it redelivers on `/model` switches, compaction, `/clear`, resume and fork (`docs/hooks.md`).
- **The delivery evidence is strong where it was measured.**
  - The run used real interactive sessions on Claude Code 2.1.330. Across 299 completed sessions, 3,090 of 3,090 requests that were due rules held them (D19), and 763 of 763 subagent requests did (D20). No session broke the invariant (D18).
  - Native alternatives did worse in the same benchmark. A user `CLAUDE.md` reached 46.9% of subagent requests (D28). `.claude/rules` reached the same 46.9%. A skill per model reached 0 of 579 requests (D27).
  - A `CLAUDE.md` also puts other models' rules into every request. Only 32.6% of its rule text was written for the request's model, against 78.6% under noonsight (D30).
- **The docs and evidence are unusually careful.**
  - Every number links to a raw result file, and `npm test` recomputes each one. Superseded results are labelled.
  - It lists its own failures (F1–F9) and its known gaps.
  - It never blocks a call, and it makes no network calls unless you turn on the optional classifier.
  - It refuses a bad configuration whole instead of guessing.
- **It is easy to try and easy to undo.** `noonsight install`, `check`, `resolve` and `report` give you the exact delivered text and a decision log. `noonsight uninstall` and `NOONSIGHT_DISABLE=1` turn it off.

**Conditions and risks**
- **Delivery is not obedience, and the benefit is mostly unproven.**
  - The delivery benchmark answers with a local stand-in for the API, so it never checks that a model changed its behaviour.
  - Measured rule effects exist only for `verify-changes` (Sonnet, Haiku), `carry-through` (Sonnet) and `low-context-report` (Fable). They come from small tasks, and the README says they are not general effects.
  - Opus 5.5 has no measured rule effect. Its attended rules also ship off.
  - On public tasks there was no quality gain: 133/144 passed without rules, against 132/144 under noonsight (B1). Every run in the rules experiment passed its hidden check either way (R8).
  - The gains it shows are behavioural, such as running tests after an edit. Decide whether that is worth having.
- **It costs tokens.** Sonnet on the fix task went from $0.024 to $0.038–$0.051 per run, and Haiku roughly doubled (R6, R7). The cost depends on the task. The backlog task was flat, at $0.2848 with the rule against $0.2920 without (R18).
- **You must write your own rules, and measure them.** The preset delivers nothing for attended Opus and Fable sessions. Attended Sonnet and Haiku sessions get little without a scope. Set `session.unattended_when_env` for unattended interactive sessions. A rule of your own has no measured effect until you measure it.
- **It is tied to the Claude Code version and to undocumented behaviour.**
  - Fork handling, the `CLAUDE_CODE_SESSION_ATTENDED` variable and the subagent metadata files are undocumented. They were recorded on 2.1.330, and the results differ across versions.
  - Pin or re-verify Claude Code versions, and re-run `noonsight report` and `check` after each upgrade.
- **Known delivery gaps matter for subagent-heavy use.**
  - Workflow agents get nothing.
  - Concurrent foreground subagents of one type that need different rules get nothing until their first edit, write or agent call.
  - Subagents from plugins noonsight doesn't read are predicted on the parent's model. This includes organization-synced plugins.
  - Agent teams in split panes, routing and the classifier are unmeasured.
  - A resumed, compacted conversation with no named model runs on the default model, which noonsight cannot detect.
  - `/fork` is unavailable in sessions started with `noonsight run`.
- **Supply-chain and maintenance risk.** It runs a hook on every session, edit and subagent call, with no runtime dependencies. The author is a single GitHub account (`bpsanti`). It was renamed from "sextant", and the evidence dates are all within about a week. Vet the package before `npm install -g`, and pin the version. Project `.noonsight` configs need `noonsight trust` on each clone.
- **Rollout.** Pilot with 3–5 people for a few weeks. Compare `noonsight report` against what people actually notice, and drop rules that change nothing visible.

**What it guarantees:** Through Claude Code's hooks, noonsight puts the rules you declared for a model into the requests of each session and subagent that runs on it, and again when the model changes or the conversation is compacted, cleared, resumed or forked. It guarantees delivery only, not that the model follows the rules. That rests on a 299-session benchmark of real Claude Code 2.1.330 sessions against a stubbed API, which the project reports as 100% coverage, plus the stated exceptions above.
