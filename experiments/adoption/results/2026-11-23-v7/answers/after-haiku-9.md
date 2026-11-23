**Verdict:** Adopt with conditions. Start with a pilot on a few machines, not a team-wide rollout.

**Reasons:**
- The core mechanism fits your setup. It delivers rules per model through Claude Code hooks, and it covers subagents, which a `CLAUDE.md` misses. In the repo's benchmark, `CLAUDE.md` reached 32.2% of subagent requests (39 of 121) against 100% (D10 vs D9 in `docs/evidence.md`).
- The coverage evidence is recent and detailed. The 2026-11-23 run on Claude Code 2.1.330 covered 100% of requests with rules due (3,090 of 3,090, D19), 100% of subagent requests (D20), and 100% on fork, `/resume` and plan-mode paths (D21). Each entry names its raw results file.
- Failures were found and fixed in public. The README lists F1–F9. Only one documented limit remains: a session compacted with no response since, then resumed with nothing that names a model, falls back to Claude Code's default model.
- It is local and cannot block work. The hooks "never block anything and never use the network." The one exception is the classifier, which is off by default.
- Your model mix is handled. Sonnet 5.5 and Haiku 5.5 get `verify-changes` and `carry-through`. On Haiku and Sonnet, `verify-changes` moved runs that ran tests after a one-file fix from 0 of 30 to 27–29 of 30 (R3). The rule is a measured effect on the repo's small tasks, not a general result.
- The guarantee is narrow enough to test. It is about what the hooks returned to Claude Code, which the team can check with `noonsight report`.

**Conditions and risks:**
- **Pilot first, and pin the Claude Code version.** The evidence covers 2.1.325–2.1.330 only, and the repo says hook behavior changes between Claude Code versions. Before rollout, confirm each team member's version is one the repo lists. Re-run `noonsight check` after every Claude Code upgrade.
- **Subagent gaps matter for you.** The README lists known holes: a workflow's agents get no rules; foreground subagents of one type that need different rules get none until their first Edit, Write or agent call; and subagents from plugins the tool doesn't read stay predicted on their parent's model. Since many of your sessions start subagents, measure this during the pilot.
- **Opus and Fable get little out of the box.** Their attended rules ship off, so an attended Opus or Fable session receives nothing from the preset until someone runs `enable`. Expect value mainly from Sonnet and Haiku, unless you enable more rules.
- **Set `session.unattended_when_env`.** Otherwise interactive sessions nobody watches get the attended profile. Set it to your CI or orchestrator variable.
- **Repo-committed rules are a shared-instruction channel.** A `.noonsight/noonsight.json` changes behavior for everyone who clones the repo. Each person must run `noonsight trust` once, and reviewers should treat rule-file changes like code changes.
- **Cost.** Rules add tokens. The `verify-changes` rule roughly doubled one Sonnet fix run's cost in the repo's test ($0.0240 to $0.0505, R6). Watch spend in the pilot.
- **Not measured:** agent teams, routing and the classifier. `routing` is off by default and should stay off until someone tests it.
- **Pre-release.** The package is `private`, version 0.0.1, and not on npm; install from a clone. Plan for maintenance by one author.

**What it guarantees:** Every Claude Code session and subagent that the hooks reach receives the rules resolved for its model, scope, place and triggers, and each delivery is written to a local decision log, which rests on the hook layer returning those rules and on the repo's stub-API benchmark (no real model calls) covering 3,090 of 3,090 requests with rules due on Claude Code 2.1.330. It does not guarantee that a model follows the rules, and it cannot see a delivery that Claude Code dropped after the hook returned.

**Scope of this review:** I read the README, `package.json`, `docs/evidence.md` and the delivery experiment's README and file list. I did not run the test suite or the benchmark. This directory is not a git repo, so I could not check the commit hashes the evidence cites. Before a final decision, run `npm test` and check one results folder against its `summary.json`.
