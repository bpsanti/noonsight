**Verdict: adopt with conditions.** Start with a pilot on a few machines, not a team-wide rollout.

I read the README, the hook contract, the evidence map, the Claude Code verification list, the changelog and the delivery benchmark's results. I ran nothing: the directory has no build and is not a git repository, so the test suite and the commit the results name are unchecked.

**Reasons**

- **It fits your setup.** Its purpose is giving each session and subagent the rules for the model it runs on, and you mix four models with heavy subagent use. Its own README says to skip it when every session runs one model; that is not you.
- **The subagent gap it closes is real in its data.** In its benchmark, a shared `CLAUDE.md` reached 60 of 128 subagent requests, and never reaches the built-in Explore and Plan subagents. noonsight reached 763 of 763.
- **The delivery claim checks out against the raw file.** The committed summary shows 300 sessions generated, 299 completed, and 3,090 of 3,090 requests with rules due holding them, as the README states.
- **It is low-risk to try.** The hooks never block or deny a call, always exit 0, and read only local files. It has no runtime dependencies, and `noonsight uninstall` or `NOONSIGHT_DISABLE=1` turns it off.
- **It is honest about its limits.** The docs list nine delivery failures found and fixed, the cases it cannot cover, and the Claude Code version behind each result.
- **The benefit is narrow.** Delivery is not obedience. Only three preset rules have a measured effect, on small tasks, and none are Opus rules. No quality gain was shown: 132 of 144 tasks passed with noonsight against 133 of 144 without.
- **It is very young.** This is version 0.1.0, the first published release, by a single author. Nine delivery bugs were fixed in the week before the current run, and every measurement is the author's own.

**Conditions and risks**

- **Platform:** it needs macOS or Linux and Node.js 20 or newer. Windows is not supported.
- **Claude Code version:** delivery was measured on 2.1.330 only. It relies on undocumented behaviours, such as the `CLAUDE_CODE_SESSION_ATTENDED` variable and fork metadata, so a Claude Code update can break delivery silently. Re-check with `noonsight check` and `noonsight report` after each upgrade.
- **Out-of-the-box coverage:** attended Opus and Fable sessions receive nothing from the preset until you enable rules. Sonnet and Haiku get most of their rules only when a session has a scope set. You will need to write your own rules or turn preset ones on.
- **Known gaps:**
  - Workflow agents get nothing.
  - Subagents from organisation-synced plugins may get the parent model's rules.
  - Parallel same-type subagents needing different rules get theirs late or not at all.
  - Agent teams are unmeasured.
  - Sessions on Bedrock, Vertex or Foundry using model aliases get a warning instead of rules unless the alias is pinned.
- **Leave routing and the classifier off.** Both are unmeasured. Routing by default auto-approves the subagent calls it changes, and in auto mode causes other calls in the same response to be refused. The classifier sends task text to a model through your login.
- **Cost:** rules add tokens. `verify-changes` roughly doubled the cost per run on small fixes (about $0.05 against $0.024 on Sonnet). Each hook adds roughly 80 to 150 ms.
- **Repository rules:** each person must run `noonsight trust` once per repository, or the committed rules silently do nothing for them.
- **Benchmark blind spot:** the benchmark uses noonsight's own resolver as its reference, so a wrong choice of rules would not show, only a missed delivery.

**What it guarantees**

It guarantees that the rules you declare for a model are placed in the requests of each session and subagent running on that model, not that the model follows them; this rests on Claude Code's hook behaviour as the author measured it on version 2.1.330.
