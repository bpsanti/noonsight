**Verdict:** Adopt with conditions. I read the README, `docs/hooks.md`, `docs/evidence.md`, the delivery experiment's failures and limits, and `package.json`. I did not run the test suite or the benchmarks, so every figure below is the project's own.

**Reasons**
- **It fits your setup.** Every session and subagent gets the rules written for the model it actually runs on. That covers Opus 5.5, Sonnet 5.5, Haiku 5.5 and Fable 5.2, and it covers subagents that run on a different model from their parent.
- **Delivery is the measured strength.** On Claude Code 2.1.330, 0 of 300 randomized sessions broke the invariant, and 3,090 of 3,090 requests held their rules (D18, D19). Subagent requests were 763 of 763 (D20). The earlier run on 2.1.328 had 1 of 300 failing sessions, which the README documents as a known limit.
- **It beats the native options for subagents.** Subagent requests held their rules 100% of the time under noonsight and 32.2% with a `CLAUDE.md` or `.claude/rules` (D9, D10). Only 79.0% of the rule text in a request was written for that request's model under noonsight, against 31.5% with a `CLAUDE.md` (D12).
- **The safety posture is good.** The hooks always exit 0, never block, never use the network, and take about 50 to 90 ms of CPU (D15). A bad configuration is refused whole and logged. Every delivery is logged, and `noonsight report` shows what was delivered. `NOONSIGHT_DISABLE=1` and `noonsight uninstall` turn it off.
- **The documentation is unusually candid.** Each number links to a raw result file that the tests recompute. The failures the fuzzer found, F1 to F9, are listed with their fixes. The README also states plainly that delivery is not obedience.
- **It is not worth adopting for its preset rules alone.** The preset's measured effects come from small tasks, with 30 to 40 runs per arm. `verify-changes` made Sonnet and Haiku run the tests in 29 of 30 and 27 of 30 runs, against 0 of 30 without it. It also roughly doubled Sonnet's cost per run on that task, from $0.0240 to $0.0505 (R6). Haiku's `carry-through` showed no effect (R11).

**Conditions and risks**
- **Version coupling is the main risk.**
  - The hooks depend on undocumented Claude Code behavior, such as fork transcripts, background-job `state.json`, and `ps` parsing on macOS. Each fact was recorded on one version, 2.1.325 to 2.1.330.
  - Claude Code ships often, and a change could silently stop deliveries.
  - Pin the Claude Code version, or rerun `noonsight check` and `npm test` on each upgrade.
  - Watch `noonsight report` for rules that are on but never delivered.
- **Immaturity and a bus factor of one.**
  - The `package.json` version is 0.0.1 and `private: true`. The README says 0.1 is not on npm yet, so you would install from a clone.
  - The repository belongs to one author.
  - Vendor the code, review it, and be prepared to maintain a fork.
- **The benchmark did not test the real thing.**
  - It ran against a stub API, so no request reached a model.
  - Its reference is noonsight's own resolver, so a wrong resolution would not show up.
  - Agent teams, routing and the classifier are unmeasured.
  - Do a pilot on a few real machines and compare `noonsight report` with what the models say they received.
- **Rules ship off for attended Opus and Fable sessions.**
  - Right after install, an interactive Opus or Fable session receives nothing from the preset.
  - Sonnet and Haiku sessions get only `verify-changes`, and only after an edit to a tracked code file.
  - To get more, you must write your own rules, use `enable`, set scopes, and set `session.unattended_when_env` for unattended CI sessions.
  - Without that work you are adopting a delivery mechanism with little content.
- **Known gaps.**
  - Workflow agents get nothing.
  - Foreground calls of one subagent type that need different rules get nothing until the subagent's first Edit, Write or agent call.
  - Plugin subagents from plugins it does not read are predicted on the parent's model.
  - `/fork` does not work in sessions started with `noonsight run`.
  - A compacted, resumed conversation with no named model runs on Claude Code's default model, and noonsight cannot tell which.
  - Split-pane teammates were not checked.
- **Keep two features off unless you review them.**
  - Routing's default `allow` permission skips permission prompts for the calls it changes.
  - In auto mode, a routed call makes Claude Code refuse the other calls in the same response.
  - The classifier, if turned on, sends the first 4,000 characters of each task to a model.
- **Delivered rules are context, not enforcement.** Keep hard requirements in hooks or permission rules. If every session ran one model with fixed rules, a `CLAUDE.md` would be simpler, and the project's own docs say so. Measure each rule you add, since an unneeded rule costs tokens and changes nothing.
- **Shared repository rules.** Each person must run `noonsight trust` once in a repository before its `.noonsight/noonsight.json` takes effect. That is a sensible gate, but it is a step to remember.

**What it guarantees:** It guarantees that each Claude Code session and subagent request carries the rules for the model it runs on, with other models' rules retired. This rests on Claude Code's own hooks and was measured on 2.1.330 by a fuzzed, stubbed-API benchmark with 0 failures in 300 sessions. It does not guarantee that the model follows the rules, that this holds on other Claude Code versions, or that it holds in the unmeasured paths listed above.
