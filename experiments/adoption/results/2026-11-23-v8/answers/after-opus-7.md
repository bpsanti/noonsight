**Verdict: adopt with conditions.** Run it as a limited pilot, and only if your team has rules that really differ by model.

I read the README, `docs/hooks.md`, `docs/evidence.md`, the delivery benchmark's README and the CHANGELOG. I did not build the tool or run its tests.

## Reasons

1. **It fixes a real gap in your setup.** You run several models and start many subagents. In the tool's own benchmark, a `CLAUDE.md` holding every model's rules reached only 46.9% (60 of 128) of subagent requests (D28). It never reaches the built-in Explore and Plan subagents, which Anthropic's docs confirm. Each model also gets every other model's rules: only 32.6% of the rule text a model received was written for it (D30). noonsight reached 100% of subagent requests (763 of 763, D20), and 78.6% of the rule text was the model's own.
2. **It's low-risk by design.** The hooks always exit 0 and never block or refuse anything. They read only local files and use no network unless you turn on the optional classifier. A configuration with any problem is refused in full rather than guessed at. There are no runtime dependencies. You can turn it off with `NOONSIGHT_DISABLE=1` or `noonsight uninstall`. Each hook run takes about 80–150 ms of CPU (D33).
3. **The evidence is unusually honest.** Every number links to a raw result file, and `test/evidence.test.ts` recomputes each one. The limits and the nine failures found so far (F1–F9) are written up in the open.
4. **It's very young.** It's version 0.0.1 / 0.1, not on npm, and installed from a clone. Every measurement dates from Nov 16–23, 2026, the last week. It was recently renamed (from sextant), and that rename broke old installs.
5. **It depends on Claude Code internals that aren't documented.** The fork handling (`forkedFrom`, the background job's `state.json`), headless detection (`CLAUDE_CODE_SESSION_ATTENDED`), subagent metadata (`toolUseId`) and duplicate-text dropping are all things the docs say were only observed on 2.1.330. Five of the nine failures (F5–F9) came from that kind of behaviour, and all nine were found within the past week.
6. **There's no proof it improves results on real tasks.** In the paid pilot on public tasks, the share of runs whose checker passed was 133, 132 and 133 of 144 with no rules, with noonsight, and with one `CLAUDE.md` (B1). Cost per run rose from $0.145 to $0.155 (B2). Individual rules did show effects on small tasks, such as `verify-changes` making Sonnet and Haiku run the tests (R3, R14). But `verify-changes` also roughly doubles the cost of a small fix (R6).
7. **Out of the box, your Opus and Fable interactive sessions get nothing.** Their preset rules for watched sessions ship turned off. The value depends on the rules you write yourself.

## Conditions and risks

**What has to hold:**
- You actually have rules that should differ by model, or that should reach subagents. If not, the README itself says to use a `CLAUDE.md`.
- Pin the Claude Code version the team uses. Re-run the tool's test corpus (`npm run delivery -- corpus`) before each Claude Code upgrade; all of its delivery results are for 2.1.330.
- Install it from a commit you have reviewed. Note that `noonsight install` changes the settings of every Claude Code login under your account, and `--managed` installs it machine-wide.
- Keep the classifier off. When on, it sends up to 4,000 characters of each task to a model through the user's login.
- Write your own rules. Set `session.unattended_when_env` for interactive sessions nobody watches, such as an orchestrator's workers. Check deliveries with `noonsight report`.
- Agree on a success measure before the pilot. Delivering a rule doesn't mean the model follows it.

**What could go wrong:**
- A Claude Code update changes how hooks behave, and rules quietly go missing or reach the wrong model. The tool's own log records what the hooks sent, not what reached the model.
- Known gaps: workflow agents get nothing. Several subagent calls of the same type that need different rules get nothing until each subagent's first edit or agent call. Plugins synced by an organization are predicted on the wrong model. Teammates running in split panes were not checked.
- Agent teams, routing and the classifier were never measured. If routing is turned on in auto mode, the other tool calls in the same response get refused and have to be made again.
- The project could be abandoned or change incompatibly; it has already been renamed once.
- Extra cost from rules like `verify-changes`.

## What it guarantees

It guarantees nothing in a strict sense. Its claim is a measurement: on Claude Code 2.1.330, all 299 test sessions that ran to the end got each model's rules on every request (3,090 of 3,090). That rests on one Claude Code version and its undocumented hook behaviour, on randomly generated sessions run against a fake API, and on a checker that uses noonsight's own logic to decide which rules were due. It says nothing about whether the models follow the rules.
