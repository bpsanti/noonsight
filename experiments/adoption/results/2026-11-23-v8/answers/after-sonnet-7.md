**Verdict: adopt with conditions.** Treat it as a pilot, not a default for everyone.

**Reasons**
- **The delivery claim is specific and well evidenced.** On Claude Code 2.1.330, 0 of 299 completed sessions broke the invariant. Rules were held on 3,090 of 3,090 requests, and on 763 of 763 subagent requests (D18–D20). This is the part that matters for a mixed Opus, Sonnet, Haiku and Fable team that uses subagents.
- **It does better than the native options where we are weakest.** On the same sequences, a user `CLAUDE.md` covered 88.2% of requests and 46.9% of subagent requests. `.claude/rules` covered 76.3% and 46.9%. Skills covered 0%. `CLAUDE.md` never reaches the built-in Explore and Plan subagents (D25–D29). It also hands every model the other models' rules, so only 32.6% of its rule text was written for the model reading it, against 78.6% under noonsight (D30).
- **The evidence is auditable.** Each README number links to an entry in `docs/evidence.md` naming its raw file and Claude Code version. The README says `npm test` recomputes the numbers. It also lists nine failures it found and fixed, and its known limits. I did not run the tests or inspect the raw result files, so I am relying on that description.
- **It is low-risk to operate.** The hooks never block anything and never use the network. The classifier is the exception and is off by default. Hook cost is 80–150 ms of CPU per run on a loaded laptop (D33). `noonsight uninstall` and `NOONSIGHT_DISABLE=1` undo it, and `noonsight report` shows what was actually delivered.
- **The rule effects are real but narrow.**
  - `verify-changes` made Sonnet and Haiku run tests after a fix in 29 of 30 and 27 of 30 runs, against 0 of 30 without it (R3, R14).
  - `sonnet-5-5/carry-through` raised completed backlogs from 9 of 40 to 32 of 40 (R10).
  - Opus 5.5 has no measured effect from any preset rule.
  - On public tasks, the paid pilot found no difference in pass rate: 133, 132 and 133 of 144 for no rules, noonsight and `CLAUDE.md` (B1).
  - So the value is in rules we write ourselves, not in the preset.

**Conditions and risks**
- **Delivery is not obedience.** A delivered rule is only context. The delivery benchmark used a stub API, so it shows rules reached requests and says nothing about model behaviour. Any rule of ours has no measured effect until we measure it.
- **Opus and Fable get nothing from the preset in attended sessions.** Those rules ship off, so nobody on those models would see any change until someone runs `enable`. Sonnet and Haiku attended sessions get `verify-changes` only after they edit a tracked code file, and their other rules need a scope. We would need to set `session.unattended_when_env` for unwatched sessions, and decide which rules to turn on.
- **Cost.** `verify-changes` roughly doubled the cost of a small Sonnet fix, from $0.0240 to $0.0505 (R6). Rules that change nothing still cost a little.
- **It is pinned to Claude Code versions.**
  - Delivery was measured on 2.1.330 and rule effects on 2.1.329.
  - It depends on undocumented behaviour, such as `CLAUDE_CODE_SESSION_ATTENDED`.
  - A Claude Code upgrade could silently break delivery. We should re-run `npm run test:live` and check `noonsight report` after every upgrade.
- **Known gaps.**
  - Workflow agents get nothing.
  - Foreground subagent calls of one type that need different rules get nothing until their first edit, write or agent call.
  - Plugins it does not read, such as organisation-synced ones, leave their subagents predicted on the parent's model.
  - A compacted-then-resumed session can run on the default model without noonsight knowing.
  - `/fork` does not work in `noonsight run` sessions that carry rules.
  - Agent teams, routing and the classifier are not measured.
- **Maturity and supply chain.** It is version 0.1 and not on npm, so it installs from a clone. The npm name holds an empty placeholder. It has no runtime dependencies, but it edits every Claude Code login's `settings.json`. Someone on the team should review the code and pin a commit before rollout.
- **Suggested path.**
  1. Start with a few people, on Sonnet and Haiku plus subagents.
  2. Write a small set of team rules and measure whether they change behaviour.
  3. If most of the team runs one model with fixed rules and no Explore or Plan subagents, a `CLAUDE.md` is simpler. The README says the same.

**What it guarantees**
It guarantees that each Claude Code session and subagent request that is due rules holds the rules written for the model it runs on, and no other model's rules left unretired. This rests on Claude Code's own hooks and a 300-session benchmark of real interactive sessions against a local stand-in API, on one Claude Code version (2.1.330), with its failures and known limits listed.
