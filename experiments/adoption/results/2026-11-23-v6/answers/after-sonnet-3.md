**Verdict:** Adopt with conditions. Run it as a pilot first, not as a team-wide default.

**Reasons:**
- **It fits your setup.** You use four models and many subagents, and noonsight is built for that case. It delivers a different rule set per model to each session and each subagent, and it re-delivers on `/model`, `/compact`, `/clear`, resume and fork (README).
- **The delivery evidence is strong and checkable.** Across 300 random sessions on Claude Code 2.1.328, 99.9% of requests (3,219 of 3,221) held the right rules. A later run on 2.1.330 covered forks, plan mode and subagents that edit files. It had 0 of 300 failing sessions and 100% coverage (3,090 of 3,090), with 763 of 763 subagent requests covered (D18–D20). Each number links to a raw result file in `docs/evidence.md`, and `npm test` recomputes it.
- **The fuzzer found real bugs.** It found nine failures, F1 to F9, such as a delivery logged as done that never reached a request and the wrong model's rules after a resume. All are fixed and kept as regression cases (33 of 33 pass, D23).
- **It beats the native options for subagents.** On the same sequences, a user `CLAUDE.md` reached 32.2% of subagent requests, `.claude/rules` reached 32.2%, and skills reached 0%. A `CLAUDE.md` also puts the other models' rules into every request: only 31.5% of its rule text was written for the request's model, against 79.0% under noonsight (D12).
- **The risk surface is small.** Hooks never block anything and never use the network, apart from an optional classifier that is off by default. There are no runtime dependencies. Uninstall is `noonsight uninstall`, and `NOONSIGHT_DISABLE=1` turns it off per session.
- **The authors are candid.** The README states what is not guaranteed, and the docs include a "when not to use" section.

**Conditions and risks:**
- **It is v0.0.1, private and not on npm.** The README says 0.1 is not published yet, so you would install from a clone and rebuild yourselves. Pin a commit and have someone own updates.
- **It depends on Claude Code internals.** It relies on undocumented behaviour, such as `CLAUDE_CODE_SESSION_ATTENDED` and how resume picks a model. Each fact is verified on a single Claude Code version at a time (2.1.325–2.1.330). Pin your team's Claude Code version, rerun `npm run test:live` on every upgrade, and run `noonsight report` regularly to catch silent breakage.
- **Out of the box, the preset does little for Opus and Fable in interactive sessions.** Their attended rules ship off, so interactive Opus and Fable sessions get nothing until you run `enable`. Sonnet and Haiku get `verify-changes` only after a code edit, and their other rules only with a scope. Decide which rules you want and write them down. Set `session.unattended_when_env` for interactive sessions nobody watches.
- **Delivery is not obedience.** The rule-effect data is thin: small tasks and 30–40 runs per arm. `verify-changes` made Sonnet run tests in 29 of 30 runs versus 0 of 30 without it, but it roughly doubled run cost ($0.0240 to $0.0505). Haiku's `carry-through` showed no effect. Measure on your own tasks, and keep hard requirements in hooks or permission rules.
- **Known gaps:**
  - Workflow agents get nothing.
  - Some foreground subagents get nothing until their first edit.
  - Plugins that noonsight doesn't read, such as org-synced ones, leave subagents predicted on the parent's model.
  - A compacted-then-resumed conversation can run on Claude Code's default model, which noonsight can't detect.
  - Agent teams, routing and the classifier are unmeasured.
  - `/fork` is unavailable in `noonsight run` sessions that have rules.
- **Organizational limits.** It won't work where managed settings forbid user hooks. Repository rules need a one-time `noonsight trust` per clone.
- **Caveats on the evidence.** The benchmark uses a stub API, and its reference is noonsight's own resolver. A wrong resolution wouldn't show up, only a wrong delivery. I didn't run the tests or the live checks, so everything here comes from reading the repo.
- **If you wouldn't benefit.** If most sessions share one model with fixed rules, a `CLAUDE.md` is simpler, and the README says so.

**What it guarantees:** For its measured Claude Code versions, noonsight guarantees that each session and subagent receives the rules for the model it actually runs on, and again when that model changes. This rests on Claude Code's hooks and a fuzzer-driven benchmark against a stub API, with every request inspected, and it does not guarantee that a model follows the rules.
