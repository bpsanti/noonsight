Verdict: **adopt with conditions**. Run it as a pilot first, and only if your team needs per-model rules that reach subagents. I read the README, `docs/evidence.md`, `docs/hooks.md` and the delivery experiment's README. I did not run `npm test` or install the tool, so every number below is the project's own claim.

**Reasons**

- **It fits your setup.** Your team mixes Opus, Sonnet, Haiku and Fable and uses subagents heavily. The tool is built for that: it gives each session and each subagent the rules for the model it actually runs on, and re-delivers them when the model changes (`/model`, `/compact`, `/clear`, resume, fork).
- **The delivery evidence is strong for what it tests.**
  - In the current run (Claude Code 2.1.330, 2026-11-23), 0 of 299 sessions broke the invariant, and 3,090 of 3,090 requests with rules due held them. 763 of 763 subagent requests did too (D18 to D20).
  - It was tested with real interactive sessions against a stub API.
  - Nine failures found by the benchmark were fixed, and each has a reproduction in the corpus.
  - Every README number links to a raw result file, and `npm test` recomputes them.
- **The native alternatives do worse on your use case.** On the first 60 sequences, a user `CLAUDE.md` covered 88.2% of requests, but only 46.9% of subagent requests. `.claude/rules` covered 76.3%, and one skill per model covered 0% (D25 to D29). A `CLAUDE.md` also puts other models' rules in every request: only 32.6% of its rule text was written for the request's model, against 78.6% under noonsight (D30).
- **It is low-risk to run.** The hooks never block anything, always exit 0, use no network (the classifier is the one exception, and it is off by default) and have 10-second timeouts. A bad config is refused whole with a warning. `NOONSIGHT_DISABLE=1` and `noonsight uninstall` turn it off. It has no runtime dependencies, an MIT license, and a decision log (`noonsight report`) you can audit.

**Conditions and risks**

- **Version coupling is the main risk.**
  - The tool depends on undocumented Claude Code behaviour: how forks find their parent conversation, `CLAUDE_CODE_SESSION_ATTENDED`, subagent metadata files, and `ps` parsing on macOS.
  - The claim is measured on 2.1.330 only. The README says Claude Code changes how hooks behave, and your team will be on whatever version auto-updates.
  - Pin or track Claude Code versions, and re-run `npm test` and `npm run test:live` on each upgrade. Treat `noonsight report` anomalies and `MISMATCH` warnings as signals.
- **It is immature and single-maintainer.**
  - Version 0.1 is not on npm (the package name holds an empty placeholder). You install from a clone with `npm link`.
  - It was renamed from sextant, and the repository belongs to one person.
  - Pin a commit and review the source before installing. It writes hooks into every Claude Code login's settings, so someone on your team needs to own it.
- **The defaults do nothing for Opus and Fable in attended sessions.** All of their attended-session preset rules ship off. Opus and Fable receive preset rules only in headless runs and subagents.
  - Sonnet and Haiku get `verify-changes` once a session edits a tracked code file, and their other rules only with a scope.
  - Without your own rules, `enable` entries, or `session.unattended_when_env` set for your CI or orchestrator, most of your team will see little change.
- **The measured effects of the preset rules are narrow.**
  - Measured effects: `verify-changes` (Sonnet and Haiku), `carry-through` (Sonnet only) and `low-context-report` (Fable).
  - `carry-through` on Haiku showed nothing, and no Opus rule has a measured effect.
  - A paid pilot on public tasks found no difference in pass rate: 133 of 144 without rules, 132 of 144 under noonsight, 133 of 144 with a `CLAUDE.md` (B1). That pilot ran on Claude Code 2.1.326.
  - `verify-changes` roughly doubles the cost of a small fix: $0.0240 without it, $0.0505 with it (R6).
  - The tasks were small and each arm had 30 to 40 runs.
  - Plan on writing your own rules and measuring them.
- **Known gaps:**
  - Workflow agents get nothing.
  - Foreground subagent calls of one type that need different rules get nothing until the subagent's first Edit, Write or agent call.
  - Plugins noonsight doesn't read, such as org-synced ones, leave their subagents predicted on the parent's model.
  - Agent teams in split panes, routing and the classifier are unmeasured.
  - `/fork` doesn't work in `noonsight run` sessions with rules.
  - A compacted conversation resumed with no model named runs on Claude Code's default model, which noonsight can't tell.
- **Team setup:** each repo's `.noonsight/noonsight.json` needs a one-time `noonsight trust` per person, and until then it changes nothing.

**What it guarantees**

It guarantees that each Claude Code request, including subagent requests, carries the rules written for the model it runs on, and none of another model's rules left unretired. That rests on hooks plus a stub-API benchmark on Claude Code 2.1.330. The benchmark's reference is noonsight's own resolver, so it tests delivery, not rule choice. It does not guarantee that the model follows the rules.
