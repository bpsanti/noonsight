**Verdict:** Adopt with conditions. Pilot it first, and don't treat it as something to roll out to everyone yet.

**Reasons:**
- **It fits your setup.** It delivers rules chosen by the model a session is actually running, and again after `/model`, `/compact`, `/clear`, resumes and forks. It also does this for subagents, which see none of the parent's conversation. A `CLAUDE.md` can't do that (README, `docs/hooks.md`).
- **Delivery is measured against the alternatives.** On the same 60 sequences, the native options delivered the right rules less often:

  | Option | Requests with their rules | Subagent requests with their rules |
  | --- | --- | --- |
  | noonsight | 100% | 100% |
  | User `CLAUDE.md` | 87.3% | 32.2% |
  | `.claude/rules` | 70.6% | 32.2% |
  | A skill per model | 0% | 0 of 121 |

  A user `CLAUDE.md` also puts other models' rules into every request. Only 31.5% of its rule text is written for the request's own model, against 79.0% under noonsight (`docs/evidence.md` D6–D12).
- **The testing was thorough.**
  - The fuzzer found nine real failures (F1–F9), all fixed, each with a regression entry. The final run had 0 of 300 sessions failing, on Claude Code 2.1.330 (D18, D23).
  - Every number in the README traces to a committed result file and is recomputed by `npm test`.
  - The README is candid about its limits.
- **The hooks are low-risk.**
  - They never block a call and never use the network. The exception is the optional classifier, which is off by default.
  - A bad config is refused whole, with a warning.
  - The cost is about 50–90 ms of CPU per hook run (D15).
  - `NOONSIGHT_DISABLE=1` turns it off for a session, and `noonsight uninstall` removes it.
- **The measured effects are real but narrow.**
  - `verify-changes` made Sonnet and Haiku run the tests in 29/30 and 27/30 runs, against 0/30 without it (R1, R3).
  - It roughly doubled the cost of the Sonnet fix, $0.0240 to $0.0505 (R6).
  - Where models already did the work, the rules changed nothing and still added a little cost.

**Conditions and risks:**
- **Run a pilot, not a rollout.** Version 0.1 isn't on npm (install is from a clone). It has one author and shows no track record outside its own tests. Pin a commit and review it, because it installs hooks into every Claude Code login on the machine.
- **Pin and re-verify the Claude Code version.**
  - It depends on undocumented Claude Code behaviour: hook inputs, transcript and job files, the `CLAUDE_CODE_SESSION_ATTENDED` variable. It was checked only on 2.1.325–2.1.330.
  - On every Claude Code upgrade, run `npm run delivery -- corpus` and `npm run test:live`. Otherwise a silent regression could go unnoticed, because the decision log records what the hook returned, not what reached the model.
- **Check the claim's basis.** The headline result used a local stub API, so no model ever read a rule. The "right rules" reference is noonsight's own resolver, so a wrong resolution wouldn't show up. Run your own spot-checks with `noonsight report` and by asking sessions what they received.
- **Fable and Opus get almost nothing by default in attended sessions.**
  - Every attended-session rule for those two ships off. Only unattended runs and subagents get Fable/Opus rules (`unattended-run` for Opus, `low-context-report` and `finish-work` for Fable).
  - Plan to write your own rules or use `enable`.
  - Set `session.unattended_when_env` for interactive sessions nobody watches.
  - Sonnet and Haiku scoped rules need `NOONSIGHT_SCOPE`.
- **Don't expect behaviour changes you haven't measured.**
  - Delivery is not obedience, and your own rules have no measured effect until you test them.
  - The preset's effects come from small tasks with 30–40 runs per arm. Haiku's `carry-through` showed nothing (6/40 against 2/40, R11).
- **Known gaps that touch your usage.**
  - Workflow agents get nothing.
  - Foreground calls of one type that need different rules get nothing until each subagent's first Edit, Write or agent call.
  - Plugins noonsight doesn't read (for example, organization-synced ones) leave their subagents predicted on the parent's model.
  - Agent teams (split panes), routing and the classifier are unmeasured.
  - `/fork` doesn't work in `noonsight run` sessions.
  - A conversation compacted with no response since and then resumed with nothing naming a model can get the wrong model's rules.
- **Watch for other hooks and auto mode.** Subagent rules go through `SubagentStart`, so the agent call is left unchanged. Keep routing off in auto mode, because a routed call makes Claude Code refuse the other calls in that response.
- **Your own rules** from `.noonsight/noonsight.json` have no effect until each person runs `noonsight trust`. That's good security, but it needs a documented step for your team.

**What it guarantees:** Each Claude Code session and subagent should receive the rules written for the model it runs on, and every other model's rules are retired. This rests on Claude Code's own hooks, which were fuzzed over 300 real interactive sessions against a local stand-in for the API on Claude Code 2.1.328 and 2.1.330. It does not guarantee that the model follows the rules.
