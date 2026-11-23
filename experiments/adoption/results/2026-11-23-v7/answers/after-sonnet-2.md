**Verdict:** Adopt with conditions. Run it as a time-boxed pilot, not a team-wide install.

**Reasons:**
- **It fits how you work.** Your team mixes Opus, Sonnet, Haiku and Fable, and many sessions start subagents. That is the case where the alternatives fall short. On the same 60 session sequences, a user `CLAUDE.md` reached only 32.2% of subagent requests (39 of 121), `.claude/rules` the same, and per-model skills 0 of 121 (D10, D11). noonsight reached 100% (D9). It also sent far less rule text meant for other models: 79.0% of rule text in a request was for the request's own model, against 31.5% for `CLAUDE.md` (D12).
- **The delivery evidence is careful.** The benchmark is a fuzzer of 300 random sessions. It covers `/model`, `/compact`, `/clear`, resume, fork, plan mode and subagents that edit files. After the fixes, 0 of 299 completed sessions broke the invariant (D18), and 3,090 of 3,090 requests with rules due held them (D19). The fuzzer found nine real bugs (F1–F9). Each is fixed, has a minimal reproduction in the corpus, and failed on the pre-fix build (D24). The README's numbers are recomputed from raw files by `npm test` (`docs/evidence.md`).
- **It is low-risk to run.** The hooks never block anything and never touch the network, apart from the optional classifier, which is off by default. Each hook costs about 50–90 ms of CPU (D15). `NOONSIGHT_DISABLE=1` and `noonsight uninstall` turn it off. `noonsight report` and `resolve` let you see what each session received.
- **The rule-effect data is real but narrow.** `verify-changes` made Sonnet and Haiku run the tests after a one-file fix in 29 of 30 and 27 of 30 runs, against 0 of 30 without it (R1, R3). Sonnet's `carry-through` raised full completion of a 13-ticket backlog from 9 of 40 to 32 of 40 (R10). The README is also candid about the costs. That fix cost $0.0505 per run with `verify-changes`, against $0.0240 without (R6), and Haiku's `carry-through` showed nothing (R11).

**Conditions and risks:**
- **The preset will do little for attended sessions out of the box.** For Opus 5.5 and Fable 5.2, every attended-place rule ships off, so an interactive session on either gets nothing until you `enable` a rule. Sonnet and Haiku attended sessions get `verify-changes` only after a tracked-file code edit, and their other rules only with a scope. Most of the value for you will come from writing and measuring your own rules. Their effect is unmeasured until you measure it, and the rule-effect results cover the preset's rules only.
- **Pin and verify the Claude Code version.** Everything was measured on 2.1.328–2.1.330, and it leans on Claude Code behavior that is partly undocumented. One example is `CLAUDE_CODE_SESSION_ATTENDED`. It also reads the parent process's `--model` argument via `ps` or `/proc`. If your team is on other versions, rerun `npm run test:live` and the delivery benchmark first. A Claude Code upgrade can silently misroute rules, so make re-verification part of your upgrade process.
- **Set `session.unattended_when_env`.** Otherwise orchestrated or CI sessions that are interactive but unwatched count as attended.
- **Maturity:**
  - It is version 0.1, not published to npm (only an empty placeholder holds the name), and installs from a clone.
  - The repository appears to be a single author's.
  - You would be taking on an unreviewed dependency that writes into every login's `settings.json`.
  - Have someone on your side read the hook code, and pin a commit.
- **Known gaps for subagent-heavy use:**
  - Workflow agents get nothing.
  - Foreground calls of one type that need different rules get nothing until the subagent's first edit or agent call.
  - Plugins it doesn't read, such as org-synced ones, leave their subagents predicted on the parent's model.
  - Agent teams in tmux split panes are unchecked, and routing and the classifier are unmeasured.
  - `/fork` doesn't work in sessions started by `noonsight run` with rules.
- **Check that your org allows user hooks.** Managed settings that forbid them would stop it from running.
- **Measure before you keep it.** Rules cost tokens, and where models already do the work the rules change nothing. After a few weeks of `noonsight report`, drop rules that never change anything you can see.
- **Don't use it for rules that must never be broken.** Delivery is context, not enforcement, and the README says so. Use hooks or permission rules for those.
- **Skip it for any group that uses one model with fixed rules.** `CLAUDE.md` reaches 100% of that session's own requests (D17), though it still misses Explore and Plan subagents.

**What it guarantees:** For each session and subagent, it guarantees that the rules written for the model actually running reach its requests, and that other models' rules are retired when the model changes. This rests on a fuzz benchmark: 0 of 299 completed sessions broke the invariant on Claude Code 2.1.330, and 99.9% (3,219 of 3,221) of requests held it on 2.1.328. Both ran against a local stand-in for the API, so no real model was involved. It does not guarantee that a model follows a delivered rule.
