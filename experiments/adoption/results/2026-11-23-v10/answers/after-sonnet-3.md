**Verdict: adopt with conditions.**

The delivery mechanism is well evidenced. The evidence that the rules improve results is thin, and it is thinnest for Opus, which you use heavily. Adopt it as a delivery layer for rules your team writes and measures. Don't adopt it for the preset's effects.

**Reasons**
- **It delivers where the alternatives fail.**
  - Under noonsight, 3,090 of 3,090 requests with rules due held them (D19). For subagents it was 763 of 763 (D20).
  - A user `CLAUDE.md` reached 46.9% of subagent requests (60 of 128, D28). `.claude/rules` did the same.
  - A skill per model reached 0 of 579 requests (D27).
  - You run several models and many subagents, which is where the native options break down.
- **It keeps other models' rules out.**
  - Under noonsight, 0 requests held another model's rules unretired (D32).
  - With `CLAUDE.md` it was 619 requests, and with `.claude/rules` 622.
  - Under noonsight, 78.6% of the rule text in a request was written for that request's model (D30), against 32.6% for `CLAUDE.md`.
  - It adds fewer characters per request: 1,343 against 4,472 for `CLAUDE.md` (D31).
- **The delivery evidence is credible.**
  - The sessions are real interactive Claude Code sessions. Only the Messages API is a local stand-in.
  - Each number links to a raw file, and `npm test` recomputes them (`test/evidence.test.ts`).
  - The authors list nine failures (F1 to F9) they found and fixed. They also state their limits openly.
- **It is low-risk to install.**
  - The hooks never block anything, and there are no runtime dependencies.
  - The licence is MIT.
  - `noonsight uninstall` and `NOONSIGHT_DISABLE=1` back it out.
  - Everything is local except the optional classifier, which is off by default.
- **The evidence that rules change outcomes is narrow.**
  - **`verify-changes` on Sonnet and Haiku:** Sonnet ran the tests after its last edit in 29 of 30 runs against 0 of 30 without rules (R3, R14). That is on a small task, and it also roughly doubled the cost per run ($0.0505 against $0.0240, R6).
  - **`carry-through` on Sonnet:** it completed the 13-ticket backlog in 32 of 40 runs against 9 of 40 (R10).
  - **`low-context-report` on Fable:** shorter sentences in the final report.
  - **No quality gain:** every run passed its hidden check with or without rules (R8, 600 of 600). The public-task pilot showed no difference (B1: 133, 132 and 133 of 144).
  - **Opus:** no preset rule has a measured effect, and the attended rules ship off.
  - The benefit is behavioural nudges, not better results.

**Conditions and risks**
- **Value comes from your own rules.** You need rules that differ by model, which `CLAUDE.md` can't carry. If you don't have them, the preset is mostly unproven. An attended Opus or Fable session receives nothing from it until you run `enable`. Trial your rules with the repo's rule-effect experiment before relying on them.
- **Claude Code version coupling.**
  - The results are pinned to specific versions (delivery on 2.1.330, rules on 2.1.329, benchmark on 2.1.326).
  - Claude Code changes how hooks behave, so check what your team runs, then re-run `npm run test:live` after upgrades.
  - Pin or stage upgrades.
- **Known delivery gaps.**
  - **Workflow agents:** a workflow's agents get nothing.
  - **Foreground subagents:** a foreground call that needs different rules from an earlier call of the same type gives its subagent nothing until that subagent's first Edit, Write or agent call.
  - **Unread plugins:** a plugin noonsight does not read, such as one your organization syncs, leaves its subagents predicted on their parent's model.
  - **Compacted-then-resumed sessions:** a compacted conversation resumed with nothing that names a model runs on Claude Code's default model, which noonsight can't tell. Your daily multi-model mix may hit this.
  - **`/fork`:** in sessions started with `noonsight run` that carry rules, `/fork` is unavailable.
  - **Unmeasured features:** agent teams, routing and the classifier.
- **Delivery is not obedience.** A delivered rule is context, like `CLAUDE.md`. Delivery was measured at the request level against a stub API, so no model answered. `noonsight report` logs what the hooks returned, not whether behaviour changed.
- **Unattended sessions need configuration.** Set `session.unattended_when_env` for CI and orchestrator sessions. Otherwise they count as attended and get different rules.
- **Repository rules need a trust step.** Each person must run `noonsight trust` once per repo, and until then the file does nothing.
- **Cost.** Rules can raise per-run cost, and the preset's own guidance flags some Fable rules at roughly +20% to +80% output tokens (these ship off). Watch spend.
- **Maintenance and bus factor.**
  - It is a young tool, renamed from "sextant".
  - It is single-maintainer, as far as I can tell from the README links.
  - It has an `on_preset_change` and `noonsight accept` review flow for preset updates.
  - Decide who owns it.
- **Skip it** if every session runs one model with fixed rules and you don't depend on Explore or Plan subagents seeing the rules. A `CLAUDE.md` is simpler there, and the README says so.
- **Pilot.** Install it on a few people, run `noonsight check` and `report` for two weeks, then expand.

**What it guarantees**
Through Claude Code's hooks, noonsight puts the rules declared for a model into the requests of each session and subagent running on that model, and again when the model changes or the conversation is compacted, cleared, resumed or forked. That is delivery, not obedience. It rests on 299 completed interactive sessions on Claude Code 2.1.330 against a local stub API, with the limits listed above.

I read the README and `docs/evidence.md`. I did not run the tests, check the raw result files, or read the source, so the numbers above are the project's own claims.
