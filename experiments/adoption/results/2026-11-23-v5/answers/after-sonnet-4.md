**Verdict:** Adopt with conditions. Run it as a time-boxed pilot first, not as a team-wide rollout.

**Reasons:**
- **It fits your setup.** Rules differ by model (Opus, Sonnet, Haiku, Fable) and by subagent. In the README's comparison, a user `CLAUDE.md` reached only 32.2% of subagent requests and sent each model other models' rules (31.5% of rule text was for the right model). noonsight reached 100% of subagent requests in the 60-session comparison, with 79.0% of rule text matching the model.
- **The delivery evidence is unusually rigorous.**
  - Every number in the README links to `docs/evidence.md`, and `npm test` recomputes it from the committed raw files.
  - The run on Claude Code 2.1.330 had 0 of 300 sessions break the invariant, with 3,090 of 3,090 requests covered (D18, D19).
  - The fuzzer found nine failures (F1–F9). All are fixed, and their reproductions are in a corpus that passes (33 of 33).
  - Coverage includes `/model`, `/compact`, `/clear`, resume, fork, plan mode and subagents that edit files.
- **The risk to your sessions is low.**
  - The hooks never block anything and never use the network. Each hook has a 10-second timeout, and the measured processor time is 50–90 ms.
  - A bad configuration is refused whole with a warning.
  - `NOONSIGHT_DISABLE=1` and `noonsight uninstall` give you a quick way out.
  - It has no runtime dependencies and an MIT licence.
- **It is honest about its limits.** The README lists what it doesn't guarantee, and rule effects are measured per rule (e.g. `verify-changes` made Sonnet run tests 29 of 30 times versus 0 of 30). The authors say plainly that small samples are not general effects.

**Conditions and risks:**
- **Claude Code version coupling.**
  - noonsight relies on undocumented behaviour, such as fork internals, background-job files, and `CLAUDE_CODE_SESSION_ATTENDED`.
  - It was verified on specific versions (2.1.325–2.1.330).
  - You need to pin or track your team's Claude Code version against `docs/verification/claude-code.md`. Run `npm run test:live` after upgrades, or expect silent drift.
- **Maturity.**
  - Version 0.1 is unpublished on npm, so you install from a clone and `npx` isn't available yet.
  - The project is a single author's, and one of 300 sessions failed in the 2.1.328 run.
  - The nine bugs were found and fixed by the author's own fuzzer, so unknown classes of failure may remain. Assign someone to own it.
- **Out of the box, it does little for Opus and Fable.**
  - Their attended-session rules ship off, so those sessions receive nothing until you run `enable`.
  - Sonnet and Haiku attended sessions get only `verify-changes`, and only after a tracked code file is edited, unless you set a scope.
  - Plan to write your own rules, and set `session.unattended_when_env` for orchestrated sessions nobody watches.
- **Known subagent gaps:**
  - Workflow agents get nothing.
  - Foreground calls of one type that need different rules get nothing until each subagent's first Edit, Write or agent call.
  - Plugins it doesn't read (e.g. organization-synced ones) are predicted on the parent's model.
  - Agent teams in split panes were not checked.
  - Check these against how your team actually uses subagents.
- **Unmeasured features:** routing and the classifier are off by default and unmeasured. Leave them off. The classifier also sends task text to a model, so it is the one network exception.
- **Rule effects are unproven for your rules and tasks.** The measured effects cover only the preset's rules, on small tasks, with 30–40 runs per arm. Rules also cost tokens (`verify-changes` roughly doubled Sonnet's cost on a small fix). Use `noonsight report` and drop rules that change nothing.
- **Repository rules need trust:** each clone needs `noonsight trust` before project rules apply. This is a reasonable safeguard, but it is an onboarding step.
- **Alternative:** if most of your sessions would run one model, or your rules are short and shared, a `CLAUDE.md` is simpler. The docs say so too.

**Suggested pilot:** have 3–5 people install it for 2–3 weeks. Add a few of your own rules for your actual model mix. Check `noonsight report` for rules that are on but never delivered, and for `MISMATCH` and `calls-differ` subagent results. Adopt team-wide only if those stay rare and the rules visibly help.

**What it guarantees:** It guarantees that each Claude Code session and subagent receives the rules written for the model it actually runs on, and receives them again when the model changes. This rests on Claude Code's own hooks, tested against a local stand-in for the API on Claude Code 2.1.328 and 2.1.330, so it is not obedience to the rules and not a guarantee on other Claude Code versions.
