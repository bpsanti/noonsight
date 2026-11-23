Verdict: **Adopt with conditions.** Pilot it on one pinned Claude Code version before rolling it out to the whole team.

Reasons:
- **It fits your mix of models and subagents.** It delivers each model's rules through Claude Code hooks, so Opus, Sonnet, Haiku and Fable sessions each get their own rules, and so do subagents. Per-model `CLAUDE.md` or `.claude/rules` setups miss subagents: the README reports 32.2% subagent coverage for `CLAUDE.md` and `.claude/rules`, against 100% for this tool (D10, D9).
- **The delivery numbers are strong, with caveats.** On Claude Code 2.1.330, after fixes, 0 of 299 completed sessions broke the rule invariant, and coverage was 100% across forks, `/resume`, plan mode and subagents (D18, D19, D21). Those runs used a local stub API, so no real model was called. The first run, on 2.1.328, had 1 of 300 sessions fail (D1).
- **The hooks are cheap and don't block.** Hook processing is about 50–90 ms per hook run (D15). The hooks never block anything and make no network calls, unless you turn on the optional classifier.
- **Rule effects are real but narrow.** `verify-changes` raised test-running after a one-file fix from 0 of 30 to 27–29 of 30 for Sonnet and Haiku (R1, R3). `carry-through` raised Sonnet's completion on a 13-ticket backlog from 9 of 40 to 32 of 40 (R10). The tasks are small, though, and the samples are 30–40 runs per arm.
- **It costs more on some tasks.** On Sonnet's fix, mean cost per run went from $0.0240 to $0.0505 with `verify-changes` alone (R6).

Conditions and risks:
- **Pin the Claude Code version.** Delivery is measured only on 2.1.328 and 2.1.330. The docs say Claude Code changes how hooks behave, so a team on another version has unverified coverage. Recheck the facts in `docs/verification/claude-code.md` before each upgrade.
- **Install is manual.** It is not on npm yet (0.1 is a placeholder), so each person installs from a clone (`npm install && npm run build && npm link`) and runs `noonsight install`. It adds hooks to every Claude Code login on the account. I did not run the install or the test suite.
- **Attended versus unattended depends on an undocumented variable.** `CLAUDE_CODE_SESSION_ATTENDED` decides it. If a Claude Code version drops that variable, every session falls into the `session` place and gets the wrong rules. CI and orchestrator sessions also need `session.unattended_when_env` set, or they are treated as attended.
- **Most preset rules for Opus and Fable are off in attended sessions.** Opus's and Fable's attended rules ship off, because the preset found them costly or side-effecting. Decide which ones to enable, or the team gets nothing for those models in interactive sessions.
- **Delivery is not obedience.** A rule is context the model may ignore. The tool guarantees delivery, not behavior.
- **Known gaps.** Agent teams, routing and the classifier are not measured. Workflow agents get no rules. Foreground subagents of one type can get none until their first edit or agent call. Plugin subagents not read by noonsight stay on their parent's model. `/fork` is unavailable in sessions started by `noonsight run` with rules. A compacted conversation resumed with nothing naming a model can run on Claude Code's default model without noonsight knowing.
- **Repo rules need trust.** A repository's `.noonsight/noonsight.json` changes nothing until each clone runs `noonsight trust`.
- **Fable evidence is thin.** The only measured Fable effect is shorter sentences in reports (R9). Measure it before relying on it.

Pilot plan I'd suggest: pin Claude Code, install on two or three machines (including one Fable and one Haiku user), use only the preset plus one or two of your own rules, and check `noonsight report` after a week. Adopt team-wide only if the report shows the expected deliveries and no unexpected rule changes.

What it guarantees: a session or subagent's requests carry the rules resolved for its model, scope, place and trigger, which the tool records in its decision log and checks against a stub API on Claude Code 2.1.328 and 2.1.330, not against live models. That rests on Claude Code's hooks firing as documented and on the benchmark harness; it does not guarantee the model follows the rules.
