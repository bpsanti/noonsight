**Verdict: adopt with conditions.**

I'd pilot it on a few people first, not roll it out to the whole team at once.

**Reasons**

- **It fits your setup.** You run several models and many subagents, and the tool delivers different rules to each model's sessions and subagents. It does this through Claude Code hooks, and it re-delivers the rules when `/model` changes the model (README, "What it guarantees").
- **The delivery numbers are strong, and they are checkable.**
  - 300 random sessions covered `/model`, `/compact`, `/clear`, resume, fork, plan mode and subagents.
  - On Claude Code 2.1.330, 0 of 299 sessions that ran to the end broke the invariant, and 100% (3,090 of 3,090) of requests that had rules due held them (D18, D19).
  - Subagent requests were 100% covered (D20).
  - The same sequences gave 87.3% with a user `CLAUDE.md`, 70.6% with `.claude/rules` and 0% with skills (D6 to D8).
  - Subagents are the clearest gap. A `CLAUDE.md` or `.claude/rules` reached only 32.2% of them (D10).
  - Each number links to a raw file, and `npm test` recomputes it.
- **The authors look for their own failures and say what they find.**
  - The fuzzer found nine real bugs, F1 to F9, such as the wrong model's rules after a resume or a fork. Each is fixed and has a reproduction that passes.
  - They confirmed the F5 to F9 reproductions fail on the build before the fixes (D24).
  - The known limits are listed, not hidden.
- **The hooks are low-risk.** The hooks never block anything and use no network, except for an optional classifier that is off by default. Runtime dependencies are zero, the license is MIT, and `noonsight uninstall` removes it. A hook run takes about 50 to 90 ms of processor time (D15).
- **The tool is honest that delivery is not obedience.** The rule-effect results are small but real. `verify-changes` took test runs from 0 of 30 to 29 of 30 on Sonnet (R1, R3). It also doubled the cost of that run, from $0.0240 to $0.0505 (R6). Haiku's `carry-through` showed no effect (R11).

**Conditions and risks**

- **Out of the box, an attended Opus or Fable session gets nothing from the preset.**
  - Those models' attended rules ship off. The preset gives Opus 5.5 `unattended-run` and Fable 5.2 `low-context-report` and `finish-work` only for headless runs and subagents.
  - You would have to turn rules on with `enable` or write your own.
  - Attended Sonnet and Haiku sessions get `verify-changes` only after a tracked code edit, and their other rules only with a scope.
  - Run `noonsight install` and `noonsight models` and read what each model receives before judging the tool.
- **Interactive sessions that nobody watches count as attended.** Set `session.unattended_when_env` for your CI or orchestrator.
- **It leans on undocumented Claude Code behaviour.**
  - One example is `CLAUDE_CODE_SESSION_ATTENDED`.
  - Claude Code releases land often (the checks cover 2.1.325 to 2.1.330) and the tool is verified one version at a time.
  - Pin the version or rerun `npm run test:live` on each upgrade. Make `noonsight check` and `noonsight report` part of your routine.
  - Five of the nine bugs it found came from Claude Code behaviour that nobody had documented.
- **Known gaps that touch your use:**
  - Workflow agents get nothing.
  - Teammates from agent teams, routing and the classifier are not measured.
  - Subagents from plugins that noonsight doesn't read, such as organization-synced ones, are predicted on their parent's model.
  - `/fork` doesn't work in `noonsight run` sessions that have rules.
  - A conversation compacted and then resumed with nothing naming a model gets the wrong model's rules.
  - Subagent coverage for foreground calls of one type that need different rules is partial until the subagent's first Edit, Write or agent call.
- **Check the install route first.**
  - Version 0.1 isn't on npm. You install from a clone with `npm link`, and the project is young (v0.1, formerly called sextant). You would be depending on a small project with one visible maintainer, so budget time to review and pin it.
  - Managed machine-wide install (`--managed`) was never run live.
  - Check that your organization's managed settings allow user hooks.
- **The benchmark was run against a stub, not real models.**
  - It measures what reached each request, not how any model behaved.
  - Its reference is noonsight's own resolver, so a wrong resolution would not show up.
  - The effect results use small tasks with 30 to 40 runs per arm, and Opus has none.
- **A rule is only context, so it must never be your only control.** Anything that must not be broken needs a permission rule or a hook of your own.
- **Context cost is real, though measured as smaller than the alternatives.** About 1,155 characters per request, against 4,415 for a `CLAUDE.md` holding every model's rules (D13). Measure your own rules before keeping them.

A reasonable pilot is two weeks with Sonnet and Haiku, and with subagent rules for Opus and Fable. Use `noonsight report` to see what was delivered, and keep only the rules whose effect you can see.

**What it guarantees**

It guarantees that each session and subagent request carries the rules resolved for its model, scope and place, and no other model's rules left unretired. That rests on Claude Code's hooks, on the version-specific behaviours listed in `docs/verification/claude-code.md`, and on a fuzz benchmark against a stub API. It does not guarantee that the model follows the rules.
