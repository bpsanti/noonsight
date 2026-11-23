**Verdict: adopt with conditions.** Start with a time-boxed pilot on a few machines, not a team-wide rollout.

**Reasons**

- **It fixes a gap we actually have.** We run four models and lots of subagents. A `CLAUDE.md` reached every request in the main conversation (D17, 526 of 526), but only 32.2% of subagent requests (D10). Claude Code's docs confirm it never reaches the built-in Explore and Plan subagents. It also sends every model the other models' rules, so only 31.5% of the rule text in a request was meant for that model (D12). With noonsight, subagent coverage was 100% (D3, D20).
- **The evidence is checkable.** Every number in `docs/evidence.md` points to a committed raw file, and `npm test` recomputes it. The fuzzer found nine real bugs (F1–F9), and each has a reproduction that passes now. On Claude Code 2.1.330, 0 of 299 completed sessions broke the invariant (D18).
- **It's low-risk by design.** The hooks always exit 0 and never block or deny a call. They read only local files, and I found no HTTP or socket calls in `src/`. If the config has a problem, it's rejected whole with a warning rather than guessed at. `NOONSIGHT_DISABLE=1` and `noonsight uninstall` turn it off. It has no runtime dependencies.
- **But the starting rules alone give us very little.** In attended sessions on Opus 5.5 or Fable 5.2, the preset delivers nothing (all those rules ship off). Sonnet and Haiku get only `verify-changes` after a code edit, plus scoped rules if a scope is set. The value depends on writing our own rules.
- **The measured effect on behaviour is narrow.** `verify-changes` got Sonnet and Haiku to run the tests after a fix (29/30 and 27/30, against 0/30), but it roughly doubled Sonnet's cost per run ($0.024 to $0.0505, R6). Elsewhere the rules mostly changed nothing. The tasks were small and each test arm had 30–40 runs.
- **It's an early, pre-release project.** Version 0.0.1 in `package.json`, not on npm, installed from a git clone of one person's repository (`bpsanti/noonsight`).

**Conditions and risks**

- **Conditions:**
  - Pin Claude Code to a version the tool was verified on (2.1.330 for the latest benchmark), and run `noonsight check` plus the live tests before each upgrade. Note that CI still pins 2.1.325, so CI doesn't cover what the README measured.
  - Write our own per-model rules, and use `enable` for any Opus/Fable preset rules we want.
  - Set `session.unattended_when_env` for orchestrators and CI. Interactive sessions nobody watches otherwise count as attended.
  - Review the install first. It adds hooks to *every* Claude Code login on the account.
  - Use `noonsight report` and the decision log during the pilot to confirm deliveries on our own setups.
- **Risks:**
  - **Upgrades can break it quietly.** It depends on Claude Code hook behaviour that changes between versions, and on an undocumented variable, `CLAUDE_CODE_SESSION_ATTENDED`. If that variable is dropped, sessions fall into the wrong place without any error.
  - **Some of our setups aren't covered:**
    - `opusplan` and the `default` model setting: it can't tell which model they select.
    - Workflow agents: they get nothing.
    - Subagents from plugins it doesn't read, such as org-synced ones: their model is guessed from the parent.
    - Several foreground calls of one type that need different rules: their subagents get nothing until their first Edit, Write or agent call.
    - Agent teams in split panes: not checked.
    - Routing and the classifier: not measured.
    - Bedrock, Vertex and Foundry: aliases map to other models there.
  - **`/fork` stops working** in sessions started with rules through `noonsight run`.
  - **The benchmark can't catch a wrong rule choice.** It judges delivery against noonsight's own resolver, so a resolver bug wouldn't show up.
  - **One basic check was never run:** that a model reads the context added at session start and after a `/model` switch. Other live checks show sessions quoting their delivered rules, which partly covers it.
  - **Maintenance:** it's a single maintainer's project at version 0.0.1.

**What it guarantees:** It doesn't promise the model will follow the rules. It only guarantees that each session and subagent gets the rules written for the model it actually runs on, at about 99.9–100% of requests. That rests on fuzzed sessions against a fake local API on Claude Code 2.1.328 and 2.1.330, with noonsight's own resolver deciding what was due, so it only holds as long as Claude Code's hooks keep behaving as recorded in `docs/verification/claude-code.md`.
