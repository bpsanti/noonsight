Verdict: **adopt with conditions**. Run it as a pilot, not a team-wide default.

**Reasons**

- **It does the one job you need, and the evidence is strong.** Your team mixes Opus, Sonnet, Haiku and Fable, and many sessions start subagents. In the project's delivery benchmark, 3,090 of 3,090 requests with rules due held them, and 763 of 763 subagent requests did (D19, D20). The benchmark used 300 generated sessions of real interactive Claude Code 2.1.330, with a stand-in API.
- **The native options do worse for your mix.** The same benchmark scored a user `CLAUDE.md` at 88.2% overall but only 46.9% for subagents (D25, D28). `.claude/rules` scored 76.3% (D26), and a skill per model scored 0% (D27). Both file-based options also put other models' rules into most requests (D30, D32).
- **The claims are checkable.** Each number links to a raw result file, and `npm test` recomputes it. The README states its limits openly, including where delivery fails.
- **The footprint is small.** There are no runtime dependencies and the license is MIT. The hooks never block anything, and each runs in about 80–150 ms of CPU (D33). The network is used only by the optional classifier, which is off by default. `NOONSIGHT_DISABLE=1` and `noonsight uninstall` back it out.
- **The measured rule effects are narrow, and they cost money.** `verify-changes` raised "ran tests after the last edit" from 0/30 to 29/30 on Sonnet (R3, R14). It also roughly doubled cost per run on that small fix, $0.0240 to $0.0505 (R6).
  - Only `verify-changes`, `carry-through` (Sonnet only) and `low-context-report` have a measured effect.
  - No quality gain was shown. Every run passed its hidden check with or without rules (R8). The paid pilot on public tasks was flat: 133 of 144 runs passed without rules, against 132 of 144 under noonsight (B1).

**Conditions and risks**

- **Your own rules would be unmeasured.** noonsight picks rules by model, scope, place and trigger, not by their text, so delivery of your rules is covered. Whether they change behavior is not. You would need to test them, and the README says as much.
- **Little arrives out of the box.** Of the 16 preset rules, the ones for Opus and Fable in attended sessions ship off. Attended Sonnet and Haiku sessions get `verify-changes` only after a code edit. They get the other rules only with a scope set through `NOONSIGHT_SCOPE`. You would need to do the following.
  - Decide which rules to enable.
  - Set `session.unattended_when_env` for any orchestrator or CI sessions nobody watches.
  - Settle a scope convention.
- **It is early and has one author.** The package is version 0.1.0, was renamed from "sextant", and has a single author. All the evidence dates from 2026-11-16 to 2026-11-23, and it was produced by the project itself. Results hold only for the Claude Code versions listed in `docs/evidence.md`, 2.1.326 to 2.1.330. Pin your Claude Code version and re-run `npm test` and `noonsight report` after upgrades. Hook behavior has changed between those versions.
- **Known delivery gaps matter for subagent-heavy teams** (README limits, `docs/hooks.md`).
  - A workflow's agents get nothing.
  - Some foreground subagents get nothing until their first Edit, Write or agent call.
  - A plugin that noonsight does not read, such as one an organization syncs, leaves its subagents predicted on the parent's model.
  - A compacted-then-resumed session may run on the default model, which noonsight cannot detect.
  - `/fork` is unavailable in sessions started with `noonsight run` that carry rules.
  - Agent teams, routing and the classifier are not measured.
- **Managed settings can block it.** If your organization forbids user hooks, it will not run. `noonsight check` reports this.
- **Tokens and cost.** It adds about 1,343 characters per request (D31), and some rules raise per-run cost, as in the `verify-changes` result above. Measure this on your own tasks.
- **Install effects.** `noonsight install` edits hooks in every Claude Code login on the account, and the plugin route covers one login each. Repository rules in `.noonsight/` need a one-time `noonsight trust` per clone.
- **What I did not do.** I read the README and the evidence, hooks and usage docs. I did not read the source code or run the tests. The figures above are the project's own, not independently reproduced.
- **Suggested pilot.** Use one or two people for two weeks, with only the rules you have a reason to enable. Check `noonsight report` for rules that are on but never delivered. Drop any rule that changes nothing you can see.
- **When to skip it.** If sessions stay on one model, a `CLAUDE.md` is simpler. If you need a rule to never be broken, use a hook or a permission rule, which is what the project's own docs say.

**What it guarantees**

Through Claude Code's hooks, noonsight guarantees that the rules declared for a model are delivered into the requests of each session and subagent running on that model. This is delivery, not obedience, and it rests on a benchmark of 300 generated sessions of real Claude Code 2.1.330 sessions run against a stand-in API. The benchmark checked what was sent and no model answered, and the guarantee holds only for the Claude Code versions it was run on.
