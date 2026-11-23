**Verdict: Adopt with conditions.**

**Reasons**

- **Subagent coverage is the decisive gap.** Your team starts many subagents. On the same benchmark sequences, noonsight delivered each model's rules to 100% of subagent requests (`docs/evidence.md` D9). A user `CLAUDE.md` reached 32.2% (39 of 121) and `.claude/rules` reached 32.2%. A `CLAUDE.md` never reaches the built-in Explore and Plan subagents.
- **Mixed models are its design target.** It picks rules by model, scope, place and trigger, so an Opus, Sonnet, Haiku or Fable session gets its own rules and not the others'. Without it, a `CLAUDE.md` gave every model all the rules. Only 79.0% of the rule text in a noonsight request was written for that request's model, against 31.5% with `CLAUDE.md` and 27.0% with `.claude/rules` (D12).
- **The delivery evidence is recent and has been fixed.** The latest run, on Claude Code 2.1.330 (2026-11-23), had 299 sessions run to the end. After fixes F5 to F9, 0 of 299 broke the invariant, and 453 of 453 requests on those paths held their rules (D18, D21). The earlier run had one failing session, which is documented as a limit.
- **It fails safe.** Hooks never block anything, use no network (the optional classifier is off by default), and read only local files. A bad configuration is refused, not guessed at.
- **The preset maps to the models you use.** It has rules for Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5, each with a source. Where measured, `verify-changes` made Sonnet and Haiku run tests in 27 to 29 of 30 runs, against 0 of 30 without it (R3).

I did not run `npm test` or the live checks. These findings come from reading the code, docs and result files.

**Conditions and risks**

- **Pin and re-verify the Claude Code version.** Every result is tied to a specific version (2.1.325 to 2.1.330). `docs/verification/claude-code.md` says to recheck the facts whenever Claude Code is upgraded. Keep your team on one version, and re-run `npm run test:live` before you move it.
- **Most preset rules won't fire in attended sessions.** Opus and Fable rules for attended sessions ship off. Sonnet and Haiku attended sessions get `verify-changes` only once they edit a tracked file, and their other rules need a scope. Someone has to choose which rules to `enable` and set `NOONSIGHT_SCOPE` on the sessions where it matters.
- **Set `session.unattended_when_env`.** Otherwise CI and orchestrator runs count as attended. Set it to the variable your CI or orchestrator actually sets.
- **Install is per person, and a repo's rules need trust.** Each person runs `noonsight install` (it writes hooks into every Claude Code login on the account). Each clone of a repo with `.noonsight/` config must run `noonsight trust` before its rules apply.
- **It is a pre-release, and the install is code with hooks.** The version is 0.1, it is not on npm, and it installs from a clone with `npm link`. Someone on the team should read the code and the hook config before it runs on every machine.
- **Delivery is not obedience.** The benchmark used a local stand-in for the API, so no real model saw a request. The rule-effect results come from 30 or 40 runs on small tasks.
- **It costs more on some tasks.** On one Sonnet fix, a run cost $0.0240 without rules and $0.0505 with `verify-changes` alone (R6). Track cost per model after you turn rules on.
- **Known gaps.** Workflow subagents get nothing. Foreground subagents of one type that need different rules get none until their first edit or agent call. Plugins it does not read leave their subagents on the parent's model. Agent teams, routing (off by default) and the classifier were not measured. A conversation compacted and resumed with no model named runs on Claude Code's default model, which noonsight cannot tell.
- **Plan mode on Haiku** runs Sonnet in Claude Code 2.1.330, and noonsight models that. Check any Haiku plan-mode session against the report.

**Suggested next step:** pilot with two or three people for two weeks on one Claude Code version. Check `noonsight report` for coverage on the subagent paths your team actually uses, and compare cost per task before rolling it out more widely.

**What it guarantees:** On each session and subagent it covers, noonsight's hooks deliver the rules written for that model, scope and place, and record each delivery in its decision log; the measured evidence is 100% of requests on the post-fix benchmark paths, on Claude Code 2.1.330 with a stub API. That rests on the hook behavior Claude Code documents and the version-specific checks listed in `docs/verification/claude-code.md`. It does not guarantee that the model follows the rules.
