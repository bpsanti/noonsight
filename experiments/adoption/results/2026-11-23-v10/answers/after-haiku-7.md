**Verdict: adopt with conditions.** Pilot it on one or two repositories with pinned versions before any team-wide rollout.

**Reasons**

- **Subagent coverage is the main gain.** In the project's own delivery run on Claude Code 2.1.330 (committed `summary.json`, key `on-g2-s1-n300`), 763 of 763 subagent requests with rules due got them. The same benchmark's `CLAUDE.md` arm covered 46.9% of subagent requests (60 of 128), and `.claude/rules` covered the same share. Your team runs many subagents, so this is the gap that matters most to you.
- **It fits a mixed-model team.** Rules are chosen by model, scope, place and trigger, so an Opus session, a Sonnet subagent and a Fable session can each get their own rules. A single `CLAUDE.md` cannot do that.
- **The main-conversation numbers hold up.** The same run shows 3,090 of 3,090 main-plus-subagent requests with rules due covered, and 0 of 299 sessions breaking the invariant. I checked these against the committed summary.
- **Delivery is logged.** `noonsight report` shows what was delivered, to which model, scope and place, and which configured rules never fired. That is useful for audit.
- **The hooks are small in what they do.** I grepped `src/` for network calls. Apart from spawning `claude`, `git` and `ps`, and the optional classifier, I found none. Nothing is sent off-machine by default.

**Conditions and risks**

Conditions for it to work for you:
- **Pin versions.** Pin the noonsight version and your Claude Code version. The evidence is for Claude Code 2.1.330 only, and the project says results differ across versions. Re-run `noonsight check` and the project's test suite after each Claude Code upgrade.
- **Review the package before installing it.** It is an unaudited npm package that registers hooks in every Claude Code login's settings, runs `ps` on macOS, and writes state under `~/.local/state`. Install an exact version, and have someone read the hook entries it writes.
- **Set `session.unattended_when_env`** to your CI or orchestrator variable. Otherwise headless-style sessions are treated as attended.
- **Use scopes for Sonnet and Haiku.** Their scoped rules do nothing in a session with no `NOONSIGHT_SCOPE`.
- **Keep `CLAUDE.md` for rules every model should follow.** Use noonsight for per-model and subagent rules.
- **Measure before you keep rules.** The measured rule effects are small-task results. Some cost a lot: `verify-changes` on Sonnet went from $0.0240 to $0.0505 per run. Quality shows no measurable gain in the pilot (133 of 144 passes without rules, 132 of 144 with noonsight).

Risks:
- **Silent gaps.** Workflow agents get no rules. Agent-team teammates in split panes are not checked. Plugins the tool does not read, such as org-synced ones, leave their subagents on the wrong model's rules. Edits made through `sed` or shell redirects do not trigger `code-edit`. New untracked files do not trigger it either.
- **Whole-config refusal.** One config problem refuses the whole file, so that session gets no rules. The only signal is a warning on screen, which people may miss.
- **Fable and Opus interactive sessions get little.** The preset ships their attended rules off. Your Fable and Opus interactive sessions will mostly get nothing unless you write rules or enable them.
- **Fragile on Claude Code internals.** Parts of the hooks rely on undocumented behavior, such as `CLAUDE_CODE_SESSION_ATTENDED`, `ps` parsing on macOS, and fork-detection heuristics. A Claude Code update can break these quietly.
- **Overhead.** The measured cost is about 1,343 characters (~336 tokens) added per subagent request, and about 16,957 characters per session.
- **Self-reported evidence.** The benchmark is run by the project's author against a stub API. It shows that rules reached the requests, not that models followed them.

**What it guarantees**

Through Claude Code's hooks, it adds each model's declared rules to the requests of each session and subagent on that model, and adds them again after a model change, compaction, clear, resume or fork. That rests on the hook contract for Claude Code 2.1.330 and on the project's stub-API benchmark, which covered 3,090 of 3,090 main-plus-subagent requests with rules due. It is delivery, not obedience, and it does not cover the known gaps above.

I did not install the package or run its test suite. The checks above come from reading the README, `docs/hooks.md`, `docs/evidence.md`, the committed benchmark summary, and a grep of `src/`.
