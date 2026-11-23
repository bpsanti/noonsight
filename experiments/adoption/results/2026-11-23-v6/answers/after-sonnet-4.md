**Verdict: adopt with conditions.** Run a time-boxed pilot on a few machines rather than rolling it out to everyone. I read the README, the hooks contract, the evidence map, the delivery benchmark design and the pilot results. I did not run the tests or the tool.

**Reasons**

- **It addresses a gap you have.** `CLAUDE.md` cannot choose rules by model, so every model reads every other model's rules.
  - In the benchmark, only 31.5% of the rule text in a request under `CLAUDE.md` was written for the request's model. Under noonsight it was 79.0% (D12).
  - `CLAUDE.md` also never reaches the built-in Explore and Plan subagents. It covered 32.2% of subagent requests, against 100% for noonsight (D10, D9).
- **The delivery claim is measured, and the author reports their own failures.**
  - Nine bugs (F1–F9) were found by fuzzing and then fixed. Each has a reproduction in the corpus, and the shortest ones are re-run as tests.
  - After the fixes, 0 of 300 random sessions broke the invariant on Claude Code 2.1.330 (D18). 100% of 3,090 requests held their rules (D19).
  - The evidence page ties every README number to a raw file, and `npm test` recomputes each number from that file.
- **It copes with model changes mid-session.** It handles `/model`, `/compact`, `/clear`, resumes, forks and plan mode, and it sends a note retiring the old model's rules. In the pilot, Claude Code swapped models by itself in 20 of 21 runs on one task. A static `CLAUDE.md` left the wrong model's rules in place with no warning.
- **It is cheap to try and to remove.**
  - Hooks run in 50–90 ms of CPU time and never block anything.
  - Nothing uses the network unless you turn on the optional classifier.
  - `NOONSIGHT_DISABLE=1` and `noonsight uninstall` turn it off, and the configuration is plain JSON.
  - There are no runtime dependencies, and the license is MIT.
- **The claims about what the rules do are modest and honest.**
  - The README says delivery is not obedience.
  - The measured effects are narrow. `verify-changes` got the tests run in 29 of 30 Sonnet runs against 0 of 30 without it (R3). `carry-through` on Sonnet went from 9 of 40 to 32 of 40 on one backlog task (R10).
  - Where the models already did the work, the rules changed nothing and still cost a little (R6). The pilot saw no outcome difference across conditions.

**Conditions and risks**

- **Pin and re-verify the Claude Code version.**
  - It relies on undocumented behaviour. That includes `CLAUDE_CODE_SESSION_ATTENDED`, the fork `state.json`, transcript contents, and parsing `ps` output on macOS.
  - Every verified fact is tied to a version (2.1.325–2.1.330). A Claude Code update can break delivery silently. The decision log records what the hooks returned, not what reached the model.
  - Before upgrading Claude Code, run `npm run delivery -- corpus` on the new version, as the project's own docs recommend. Someone on your team must own this.
- **The immature package is a real risk.**
  - Version 0.1 is not on npm, so you would install from a git clone. The `noonsight` package name on npm is an empty placeholder.
  - It appears to be a single-author project. Nothing in what I read shows outside users or review.
  - Fork or vendor a specific commit and review the hooks before installing them machine-wide.
- **The preset does little for Opus and Fable sessions you watch, so budget for writing your own rules.**
  - Opus 5.5's and Fable 5.2's attended rules all ship off.
  - Sonnet and Haiku attended sessions get only `verify-changes`, and only after a tracked code edit. Their other rules need `NOONSIGHT_SCOPE`.
  - Set `session.unattended_when_env` for any unwatched interactive sessions. Run `noonsight check` on each model to see what it actually receives.
- **Gaps that matter for subagent-heavy use:**
  - Workflow agents get nothing.
  - Foreground calls of one type that need different rules give their subagents nothing until the first edit or agent call.
  - Plugin subagents that noonsight does not read, such as organization-synced ones, are predicted on the parent's model.
  - Agent teams in split panes, routing and the classifier were not measured.
  - A compacted conversation resumed on Claude Code's default model, with nothing naming the model, gets the wrong rules.
  - `/fork` does not work in `noonsight run` sessions that have rules.
- **Cost.** `verify-changes` roughly doubled the cost of a cheap Sonnet task ($0.0240 to $0.0505, R6). Check each rule's cost with `noonsight models` and `noonsight report`, and drop any that change nothing you can see.
- **The effect data is thin.** There are 30–40 runs per arm on small tasks, and only for the preset's rules. Any rule your team writes has no measured effect until you test it.
- **Per-repo configuration needs a trust step.** Each person must run `noonsight trust` in a clone before a committed `.noonsight/noonsight.json` applies. That is a safe default, but it means rules do not reach teammates until they do it.
- **Suggested pilot.** Use two to four weeks on a few machines and repos. Include Opus, Sonnet, Haiku and Fable sessions, plus subagent-heavy work. Success means `noonsight report` shows deliveries for every model you use, with no `MISMATCH` or `config-invalid` lines you cannot explain. It also means at least one rule of yours shows a behaviour you can see.

**What it guarantees**

For a given model, scope, place and trigger, it guarantees that the rules written for that model reach every request of that model, including subagents, in the paths tested; this rests on hooks checked against a local stand-in for the API on Claude Code 2.1.328–2.1.330, and it does not guarantee the model follows them.
