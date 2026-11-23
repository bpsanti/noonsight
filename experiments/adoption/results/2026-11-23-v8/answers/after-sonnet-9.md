**Verdict: adopt with conditions.**

I read the README, the evidence map, the Claude Code facts page, the delivery benchmark's limits and the "when not to use" section. I did not run the tool or its test suite. Every number below comes from the repo's own committed results.

**Reasons**

- **It fits your setup.** It delivers instructions by model, to sessions and to the subagents they start. You use four models with many subagents, which is the case it was built for.
- **Delivery is measured, not assumed.** In 299 real interactive Claude Code 2.1.330 sessions, 0 broke the invariant. Of 3,090 requests with rules due, all 3,090 held them, and so did all 763 subagent requests (D18–D20). The sessions covered `/model`, `/compact`, `/clear`, resumes, forks, plan mode and subagents.
- **It beats the native options on coverage.**
  - A user `CLAUDE.md` covered 88.2% of requests and 46.9% of subagent requests. It never reaches the built-in Explore and Plan subagents.
  - `.claude/rules` covered 76.3% and 46.9%.
  - Skills covered 0%.
  - `CLAUDE.md` and `.claude/rules` also put other models' rules in the request. Of the rule text in a request, 32.6% and 27.9% was written for that model, against 78.6% under noonsight (D30).
- **It adds little weight.** It adds about 1,343 characters per request, against 4,472 for `CLAUDE.md` (D31). Each hook run takes 80–150 ms of processor time (D33).
- **Its own claims are checked.** `npm test` recomputes every README number from the raw result files. The authors list nine failures they found and fixed, and the 33-entry corpus of their reproductions passes (D23). They also say plainly what they didn't measure.
- **The hooks never block anything and never use the network.** The one exception is the optional classifier, which is off by default.

**Conditions and risks**

- **Version coupling is the biggest risk.**
  - It relies on Claude Code behaviour that is partly undocumented. `CLAUDE_CODE_SESSION_ATTENDED` is one example. It also reads the parent process's `--model` argument by `ps`.
  - The delivery claim is measured on Claude Code 2.1.330 only. The rule-effect results are on 2.1.329, and the paid pilot is on 2.1.326.
  - Pin your team's Claude Code version. Re-run `npm run test:live` and the delivery benchmark before each upgrade.
- **Out of the box, Opus and Fable sessions get almost nothing.**
  - Their attended-session rules ship off, so an attended Opus or Fable session receives nothing from the preset until you `enable` a rule.
  - Sonnet and Haiku rules mostly need a scope.
  - You would be adopting it as a framework for your own per-model rules. Budget time to write them.
- **Delivery is not obedience.** The rules are context, and the model can ignore them.
  - Measured effects exist only for a few preset rules: `verify-changes`, `carry-through` on Sonnet, and `low-context-report` on Fable. Opus has none. Your own rules have no measured effect until you measure them.
  - The paid public-task pilot showed no difference in pass rate: 133 of 144 without rules, 132 under noonsight, 133 with a `CLAUDE.md`. It ran on 2.1.326.
- **Some rules cost money.** `verify-changes` roughly doubled the cost of a small fix on Sonnet, from $0.0240 to $0.0505 per run (R6).
- **Known gaps in subagent and session delivery:**
  - A workflow's agents get nothing.
  - Foreground subagent calls of one type that need different rules get nothing until the first Edit, Write or agent call.
  - Plugins that noonsight doesn't read, such as organization-synced ones, are predicted on the parent's model.
  - A compacted conversation resumed with nothing naming a model runs on the default model, and noonsight cannot tell.
  - Agent teams, routing and the classifier are not measured.
  - `/fork` doesn't work in a session started with `noonsight run`.
- **Hooks must be installable.** This fails if your organization's managed settings forbid user hooks. `noonsight check` reports it.
- **Maturity is early.**
  - Version 0.1 is not on npm. You install it from a clone, and the npm name is an empty placeholder.
  - The project is from one author's repository, and the code predates a rename from "sextant".
  - The delivery sessions use a local stand-in for the API, so no model answered them. The harness checks its own resolver's output, so a wrong resolution would not show up there (the README's own limit).
  - The code is only a few days old. The evidence runs are dated 2026-11-16 to 2026-11-23.
- **Unattended sessions must be flagged.** Set `session.unattended_when_env` for interactive sessions nobody watches, or they count as attended.
- **Trust:**
  - Repository rule files only apply after each person runs `noonsight trust`.
  - It writes into every Claude Code login's `settings.json`, so review the installer before rolling it out.

**What it guarantees**

It guarantees that each request carries its own model's rules, and none left over from another model, and that includes subagent requests. That rests on hooks that choose rules by model, scope, place and trigger, never by the rule's text. It is measured on one Claude Code version (2.1.330) against a stand-in API, and it does not guarantee that a model follows a rule.
