**Verdict: adopt with conditions.** Run it as a limited trial first, not a team-wide rollout.

**Reasons**

- **It addresses a real gap in how you work.** You run four models and many subagents, which is where Claude Code's built-in options fall short:
  - With every model's rules in a `CLAUDE.md`, only 32.2% of subagent requests carried their model's rules. The built-in Explore and Plan subagents never receive `CLAUDE.md` at all.
  - With noonsight, 99.9% of subagent requests did (`docs/evidence.md`, D3 and D10).
  - With `CLAUDE.md`, each model also gets the other models' rules. Requests holding another model's rule with nothing to cancel it: 706 with `CLAUDE.md` against 22 with noonsight (D14).
- **Out of the box, your daily hands-on sessions get almost nothing.** A session someone is watching gets no preset rules unless it is started with a task type (a "scope", e.g. `NOONSIGHT_SCOPE=build`) (`docs/usage.md:109`).
  - Opus 5.5's only rule switched on by default applies to unattended runs only. Opus subagents get nothing (`presets/claude/preset.json:183-236`).
  - Fable's session rules are off by default.
  - So the default benefit is mostly Sonnet, Haiku and Fable subagents, plus unattended runs. Getting more means setting scopes and marking unattended runs.
- **The evidence that the rules help is thin and mixed.**
  - Clear win: `verify-changes` made Sonnet and Haiku run the tests after a fix (30 of 30 against 0 of 30). But it roughly doubled the cost of that cheap task ($0.024 to $0.0505 on Sonnet), and every run passed its hidden check with or without the rules (R1, R6, R8).
  - Haiku's `carry-through` showed nothing (R11).
  - There is no data at all on whether the rules change Opus's behaviour. Fable has only one measure, sentence length in reports.
  - The tests are small tasks with 30 to 40 runs each, as the README itself says.
- **The project is very new.** It is version 0.1, not yet on npm, and installed from a git clone.
  - All the evidence is from 14–20 Nov 2026, on Claude Code 2.1.325–2.1.329.
  - The two most recent delivery bugs (F3, F4) were fixed, but the 300-session random test run was not repeated afterwards (`README.md:22`).
  - It relies on Claude Code details that can change in any release: hook inputs, reading the `claude` process's command line, and parsing session transcripts.
- **The mechanical risk is low.** The hooks never block anything and never use the network (the optional classifier is the one exception and is off by default). A hook run takes 60–120 ms of CPU (D15). It has no runtime dependencies, carries an MIT licence, and can be removed with `noonsight uninstall` or turned off per session with `NOONSIGHT_DISABLE=1`.

**Conditions and risks**

Conditions:
- **Pin one Claude Code version for the team.** On each upgrade, re-run the project's own checks (the hand-kept corpus and `npm run test:live`) before moving. `docs/verification/claude-code.md` lists every Claude Code behaviour it depends on and the version each was checked on.
- **Configure it for your sessions.** Declare all four models. Set `session.unattended_when_env` to your CI or orchestrator variable. Give tasks scopes, or the preset delivers almost nothing.
- **Start with a few people and measure.** Use `noonsight report` and your own cost data. Drop any rule that changes nothing you can see, since each one still costs tokens.
- **Review the code before installing.** Pin a specific commit, because the install writes hooks into every Claude Code login on the account.
- **Leave routing and the classifier off at first.** With routing on, in auto mode, rewriting one agent call can leave the other agent calls in the same response refused until Claude makes them again (`claude-code.md:46`). The classifier also sends task text to a model.

Risks:
- **Breakage can go unnoticed.** A Claude Code upgrade could quietly stop delivery. noonsight's log records what its hook returned, not what reached the model.
- **Known gaps hit subagent-heavy use.** When one response makes several agent calls of the same type that should get different rules, those subagents get no rules. A conversation compacted and then resumed with nothing naming a model may get the wrong model's rules.
- **Some paths were never tested for delivery.** These include `/resume` inside a session, forks, plan mode, agent teams, project configurations, and subagents that edit files.
- **Costs go up.** Any rule that works, like `verify-changes`, adds model work and spend.

**What it guarantees:** It promises only that each session and subagent is handed the rules set for the model it is actually running on, not that the model follows them. That rests on one random test run of 300 sessions on Claude Code 2.1.328 against a local stand-in for the API (99.5% of requests correct, before the F3 and F4 fixes), and on Claude Code hook behaviours checked on 2.1.325–2.1.328 that any release can change.

I based this on the docs, the evidence files and the preset. I did not run its test suite or install it.
