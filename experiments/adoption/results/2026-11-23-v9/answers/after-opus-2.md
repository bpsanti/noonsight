**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines first, not as a team-wide rollout.

**Reasons**

1. **It fixes a gap your setup actually has.** Your team mixes models and uses many subagents. In the tool's own benchmark (Claude Code 2.1.330), a single `CLAUDE.md` with every model's rules reached 100% of main-conversation requests but only 46.9% of subagent requests (60 of 128). It also never reaches the built-in Explore and Plan subagents. noonsight delivered to 3,090 of 3,090 requests that were due rules, including 763 of 763 subagent requests (`docs/evidence.md` D19, D20, D28, D34).
2. **It stops each model from seeing the others' rules.** With `CLAUDE.md` or `.claude/rules`, every model gets every model's rules: 619 to 622 requests held another model's rules and nothing said to ignore them. Only about 30% of the rule text in a request was for the model actually running. Under noonsight that count was 0, and it added about 1,343 characters per request against about 4,472 for `CLAUDE.md` (D30–D32).
3. **There is no evidence that it improves outcomes overall.** A paid pilot on public tasks passed 133, 132 and 133 of 144 runs with no rules, with noonsight and with `CLAUDE.md` (B1). In that pilot, rules reached the main conversation only, not subagents. The effects that were measured are narrow and come from small tasks:
   - `verify-changes` got Sonnet and Haiku to run the tests after a fix (0 of 30 runs without it, 27–29 of 30 with it).
   - `carry-through` helped Sonnet finish a 13-ticket backlog (9 of 40 without, 32 of 40 with).
   - `low-context-report` shortened Fable's report sentences.
   - Nothing was measured for Opus.
4. **It is very new.** It is version 0.1.0. Every run is dated 2026-11-16 to 2026-11-23, today being the last day. The delivery benchmark found nine bugs (F1–F9) in that week, all in resume, fork and model-switch handling, and all fixed before the current run. One author wrote both the tool and the evidence. The documentation is careful: every number is tied to a raw results file, and a test recomputes it from that file. But nobody outside the project has reproduced the results.
5. **Out of the box, Opus and Fable get almost nothing in normal use.** All the preset's Opus and Fable rules for watched (interactive) sessions ship turned off. An interactive Opus or Fable session receives nothing until you turn rules on with `enable`. Sonnet and Haiku mostly need a scope set (`NOONSIGHT_SCOPE`) before their scoped rules arrive.

**Conditions and risks**

- **Pin the Claude Code version and re-check on upgrades.** Results hold only for the version they ran on: delivery for 2.1.330, rule effects for 2.1.329 (2.1.328 for Fable). The tool relies on hook behaviour Claude Code does not document, such as `CLAUDE_CODE_SESSION_ATTENDED` and subagent metadata files. After each Claude Code upgrade, run `noonsight check` and `noonsight report` and look for `MISMATCH` warnings.
- **Know which subagents it misses** (`docs/hooks.md`, "What the prediction does not see"):
  - Workflow agents get nothing.
  - Agents from plugins it doesn't read, such as ones your organization syncs, are assumed to run on the parent's model.
  - Agent-team teammates in split panes were never tested.
  - When several subagents of the same type that need different rules start together, each gets nothing until its first Edit, Write or agent call.
  - Agent teams, routing and the classifier were never measured.

  If your subagent use goes through workflows or org-synced plugins, the main benefit shrinks a lot.
- **Bring your own rules and measure them.** The preset is narrow and was measured on small tasks. Keep in `CLAUDE.md` whatever every model should get. Put only what differs by model or by subagent into noonsight. The two measured rules also roughly doubled cost per run on small fixes ($0.024 → $0.050 for Sonnet).
- **Treat it as supply-chain exposure.** `noonsight install` adds hooks to every Claude Code login on the account. They run on every session start, model switch, Edit, Write and agent call, at about 80–150 ms of processor time each. I grepped `src/` and found no network calls except the classifier, which is off by default and goes through your own Claude Code login. The hooks always exit 0 and never block anything. Still, pin an exact npm version and review updates before taking them. Don't use `npx` (the hooks stop working when npm's cache is cleared). Keep `routing` off: it is the one feature that rewrites agent calls and can grant permission, and in auto mode a rewritten call causes the other calls in the same response to be refused.
- **Other things that could go wrong:**
  - A configuration with any error is refused whole, so a bad edit silently turns delivery off; the only sign is an on-screen warning.
  - `/fork` stops working in sessions started with `noonsight run`.
  - On macOS, model detection sometimes reads the command line, which can be ambiguous.
  - Some resumes after a compaction run on Claude Code's default model, which noonsight can't detect.

**What it guarantees:** It guarantees delivery only, meaning that each session and subagent it can identify gets the rules declared for its model (again after `/model`, compaction, `/clear`, resume and fork), not that the model follows them. That rests on Claude Code's hooks behaving as they did on 2.1.330, on noonsight correctly predicting each subagent's model, and on one benchmark of 299 real sessions against a fake API where no model answered, checked against noonsight's own rule resolver.
