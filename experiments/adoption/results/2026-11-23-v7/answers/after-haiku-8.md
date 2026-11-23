**Verdict:** Adopt with conditions. Run it as a two-week pilot on one or two repositories before rolling it out to everyone.

**Reasons:**
- **Subagent coverage is the gap it fills.** On the same sequences, a user `CLAUDE.md` reached 32.2% of subagent requests (39 of 121) and `.claude/rules` reached 32.2% as well. A skill per model reached 0%. noonsight reached 100% of subagent requests (763 of 763) in the 2026-11-23 run on Claude Code 2.1.330. Your team's many subagent sessions are where the native options fall short.
- **It covers all four of your models.** The preset has rules for Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5, and each rule cites its source (`presets/claude/SOURCES.md`).
- **The latest run came after real failures were fixed.** The fuzzer found nine failures (F1 to F9), and all are fixed. In the 2.1.330 run, 0 of 299 sessions that ran to the end broke the delivery invariant, and 453 of 453 requests on the new paths held their rules.
- **The footprint is small and safe to remove.** Hooks never block, the only network use is an optional classifier that is off by default, there are no runtime dependencies, and `noonsight uninstall` removes the hooks.
- **Its limits are written down.** The README lists what is not measured: agent teams, routing and the classifier. It also lists known subagent gaps and one compact-then-resume case where it cannot tell the model.

**Conditions and risks:**
- **The guarantee is tested on one Claude Code version.** The headline results are for 2.1.330 (and 2.1.328 for earlier runs). Confirm your team's version matches, or rerun `npm run delivery` on yours before relying on it. `docs/verification/claude-code.md` lists the hook facts it depends on, per version.
- **Delivery is not obedience.** The benchmark checks that the right text reaches the model. It does not check that the model follows it. The rule-effect results are small (30 to 40 runs per arm, small tasks). `verify-changes` got Sonnet and Haiku to run tests in 29/30 and 27/30 runs, where baseline was 0/30. On Sonnet, that roughly doubled a small fix's cost ($0.024 to $0.0505). Nothing was measured on Opus.
- **Opus and Fable attended sessions get nothing from the preset by default.** Their attended rules ship off. Decide which to enable with `enable`, or accept that those sessions get only your own rules.
- **Sonnet and Haiku need scopes to get their scoped rules.** Without `NOONSIGHT_SCOPE`, interactive sessions receive only the unscoped rules.
- **Set `session.unattended_when_env`.** Otherwise, CI or orchestrated interactive sessions are treated as attended. Headless `claude -p` and Agent SDK runs are unattended by default.
- **Subagents have known gaps.** Workflow agents get no rules. Foreground calls of one type that need different rules give their subagents none until each one's first edit or agent call. Plugin subagents may be predicted on their parent's model.
- **Installation is from git.** Version 0.1 is not on npm, so each person clones and runs `npm link`. Repository configs need `noonsight trust` by each person who clones the repo.
- **Cost rises modestly.** In the benchmark, the average cost per run went up by about 3% on Fable and Haiku, and by about 19% on Sonnet, with the preset on. Opus was flat.
- **Pick an owner.** One person should own the preset version (`on_preset_change` and `noonsight accept`), review `noonsight report`, and drop rules that never change anything.
- **Caveat on my review:** I only had read and search tools, so I did not run the test suite. The conclusions rely on the committed results files and the README's claims, which I checked against the raw summaries.

**What it guarantees:** For sessions and subagents on the Claude Code version it was measured on, each request receives the rules written for its model and retires other models' rules with a visible note, as shown by the decision log and a stub API on 299 sessions in the 2.1.330 run. That rests on Claude Code's hooks returning the text noonsight gives them, not on the models obeying the rules and not on live API traffic.
