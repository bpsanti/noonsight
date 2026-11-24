**Verdict:** Adopt with conditions. Run it as a time-boxed pilot on a few machines first, not as an immediate team-wide rollout.

**Reasons:**
- **It fits your setup.** Your team mixes Opus, Sonnet, Haiku and Fable and starts many subagents. A single `CLAUDE.md` can't give each model its own rules. noonsight sends each session and subagent only the rules written for the model it runs on. It re-sends them when the model changes or the conversation is compacted, cleared, resumed or forked.
- **The subagent result is the strongest evidence.** In the delivery benchmark, noonsight delivered rules on 763 of 763 subagent requests with rules due. A user `CLAUDE.md` and `.claude/rules` each reached only 60 of 128 (46.9%), and a skill per model reached 0 of 128 (docs/evidence.md D20, D28, D29). The built-in Explore and Plan subagents never read `CLAUDE.md`.
- **It avoids cross-model rule leakage.** Under noonsight, 0 requests held another model's rules with no note retiring them. A `CLAUDE.md` or `.claude/rules` approach had 619 and 622 such requests (D32). It also adds fewer characters per request (1,343 against about 4,000 to 4,500, D31).
- **The evidence is unusually checkable.** The sessions are real interactive Claude Code sessions, and the generator is seeded, so runs are reproducible. Every README number links to a raw result file that `npm test` recomputes. The author also reports their own failures (F1 to F9), shows the before-fix reproductions, and lists known limits up front.
- **The hooks are light and reversible.** Per docs/hooks.md and docs/install.md, the hooks never block anything. They use the network only if you turn on the optional classifier. There are no runtime dependencies, and `noonsight uninstall` or `NOONSIGHT_DISABLE=1` turns it off. A hook run takes 80 to 150 ms of CPU (D33).

**Conditions and risks:**
- **Delivery is not obedience.** The guarantee is that the text arrives, not that the model follows it. The delivery benchmark answered every request from a local stub, so no model ever read the rules.
- **Its pass/fail check uses its own resolver.** The delivery oracle defines the "right rules" with noonsight's own resolver. That proves internal consistency, not that the rules are right.
- **The behavioural evidence is thin and narrow.**
  - A few rules show an effect: `verify-changes` on Sonnet and Haiku, `carry-through` on Sonnet, and `low-context-report` on Fable.
  - `verify-changes` roughly doubled Sonnet's cost per run (about $0.024 to $0.050 on the fix task).
  - No Opus rule has a measured effect.
  - There was no measurable quality difference in the pilot (133, 132 and 133 of 144 runs passed, B1).
  - The tasks are small, so treat these as results on those tasks, not general effects.
- **Defaults give you little on Opus and Fable.** Their attended-session rules ship off, so those sessions get nothing until you enable rules. Sonnet and Haiku scoped rules need `NOONSIGHT_SCOPE`. Interactive sessions nobody is watching need `session.unattended_when_env` set to your orchestrator's variable.
- **Your own rules are the real payoff, and nothing has measured them.** Plan to write team rules and test them with `noonsight report` and your own runs. Drop any rule that changes nothing.
- **Known delivery gaps matter given your subagent use.**
  - Workflow agents get nothing.
  - Foreground subagent calls of one type that need different rules get nothing until each one's first edit, write or agent call.
  - Subagents from plugins noonsight can't read, such as an organization-synced plugin, are predicted on their parent's model.
  - Agent-team split panes were not checked.
  - Compacting and then resuming with no model named can leave noonsight guessing the model.
  - Sessions started through `noonsight run` with rules can't use `/fork`.
- **Version coupling is the biggest ongoing risk.** It depends on Claude Code hook behaviour, and results are pinned to 2.1.330 (the delivery run) and earlier versions. A Claude Code update can break it silently. Pin or test your Claude Code version, and run `npm run delivery -- corpus` or the live tests on each upgrade.
- **It is young and single-maintainer.** It is version 0.1.0, renamed from "sextant", with one author (bpsanti) and no adoption history I could see. Review the source before installing hooks across every login on a machine, and decide who owns upgrades. Managed organization settings that forbid user hooks would block it (`noonsight check` reports this).
- **I did not run it.** Everything above comes from reading the repository, so I haven't confirmed the numbers by running `npm test` or the benchmark.

**What it guarantees:** Through Claude Code's hooks, noonsight puts the rules you declared for a model into the requests of each session and subagent running on it, including after model changes and lifecycle events, with documented exceptions. That rests on a seeded, reproducible benchmark of real Claude Code sessions against a local API stub. It found 0 invariant failures in 299 sessions on Claude Code 2.1.330, and it guarantees delivery of text only, not that the model follows it.
