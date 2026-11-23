**Verdict:** Adopt with conditions. Pilot it on a few machines and one or two repositories first, and keep your existing `CLAUDE.md` for rules that every model should always follow.

**Reasons:**
1. Your team mixes four models and heavy subagent use, which is the case noonsight is built for. Its README reports that `CLAUDE.md` reached 32.2% (39 of 121) of subagent requests, against 100% (668 of 668) under noonsight on the earlier build (D3, D9, D10). These figures come from the author's own benchmark, so treat them as the tool's claim, not yours.
2. The delivery benchmark is detailed and checkable. It runs 300 real interactive sessions with `/model`, `/compact`, `/clear`, resumes, forks, plan mode and editing subagents, against a local stand-in for the API. The raw results are committed under `experiments/delivery/results/`, and `docs/evidence.md` maps each number to its source file. Latest run: 0 of 300 sessions broke the invariant, and 100% (453 of 453) of fork, plan-mode and subagent-edit requests held their rules (D18, D21). I did not run `npm test` or recompute the numbers, so these are read from the files, not re-verified.
3. Delivery is selected by model, scope, place and trigger, not by rule text, and the hooks never block anything. A repository's own rules stay inert until each person runs `noonsight trust`, which is a reasonable control for a shared repo.
4. The preset is conservative. Opus and Fable attended rules ship off because the author measured cost increases: `fable-5-2/code-ownership` raised output tokens by about 70–80%. The Sonnet `verify-changes` rule doubled the cost of a one-file fix ($0.0240 → $0.0505, R6), so someone has to decide whether that trade-off is worth it.

**Conditions and risks:**
- **Subagent gaps the README documents (we use many subagents):**
  - A workflow's agents get no rules.
  - Foreground calls of one type that need different rules give their subagents none until their first Edit, Write or agent call.
  - Subagents from a plugin noonsight does not read, such as one an organization syncs, are predicted on their parent's model.
  - Agent teams, routing and the classifier are not measured.
  
  Audit these against the agent types we actually use before relying on subagent rules.
- **Version pinning.** The benchmark ran on Claude Code 2.1.328 and 2.1.330 only, and the README says hook behaviour changes between versions. Pin one version for the pilot, and rerun `noonsight check` and `noonsight report` after any upgrade.
- **Setup scope.** `noonsight install` adds hooks to every Claude Code login of the account on the machine. Pilot on machines whose owners agree to that. Use `noonsight uninstall` to back out.
- **Unattended sessions.** Set `session.unattended_when_env` to our CI or orchestrator variable. Otherwise, headless and orchestrated runs may get the attended rules, or the wrong set. Check with `noonsight resolve <model> <scope> <place>`.
- **Data leaving the machine.** The classifier is off by default. If enabled, it sends the first 4,000 characters of each task to a small model through the user's own Claude Code login. Decide whether that is acceptable before turning it on.
- **Distribution.** It is not on npm yet. Installing means cloning the repository and running `npm link`, which every person on the team would have to do.
- **Rules are context, not obedience.** The tool guarantees delivery, not that the model follows the rule. The Sonnet and Haiku effect results use 30–40 runs on small tasks, so they do not show general effects.
- **The author is the evaluator.** The benchmark, fuzzer, oracle and corpus all come from the same repository, and the "99.9%" headline is from an earlier build (2.1.328), before the fixes. The current 0-of-300 result is on one seed and one Claude Code version. A pilot with our own sessions is the real test.

**What it guarantees:** On the Claude Code versions measured, each session and subagent receives, at each request, the rules resolved for its model, scope and place, and no other model's rules are left unretired, as measured by the benchmark's stub-API runs (0 of 300 failing sessions on 2.1.330, one seed). This rests on the committed delivery benchmark and its oracle, not on the model obeying the rules, and it does not cover agent teams, routing, untested Claude Code versions, or subagents from plugins noonsight cannot read.
