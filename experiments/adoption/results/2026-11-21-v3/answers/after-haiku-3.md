**Verdict:** Adopt with conditions.

**Reasons:**
- The main claim is measured. In 300 simulated Claude Code 2.1.328 sessions (including Fable, Opus, Sonnet and Haiku, with `/model`, `/compact`, `/clear`, resumes, subagents and edits), 3,199 of 3,216 rule-due requests (99.5%) held their model's rules (D2). Subagent requests were 667 of 668 (D3) (`docs/evidence.md`).
- Your team's main workload is subagents, and that is where the native alternatives fail. A `CLAUDE.md` covered 32.2% of subagent requests and `.claude/rules` the same, with Explore and Plan never reached (D10). Skills covered 0% (D8, D11). Noonsight's `SubagentStart` hook covered Explore and Plan too.
- Native mechanisms also give every model every other model's rules. Only 31.6% (`CLAUDE.md`) and 27.1% (`.claude/rules`) of the rule text in a request was written for that request's model, against 78.8% under noonsight (D12).
- It fails loudly where it can. It logs each delivery, `noonsight report` lists rules that were on but never delivered, `noonsight check` catches stale installs, and `NOONSIGHT_DISABLE=1` turns it off per session.
- The rule-effect results are modest but real on small tasks. `verify-changes` delivered alone moved Sonnet and Haiku from 0 of 30 to 27–29 of 30 test runs, at a cost of about double per run on Sonnet's fix (R3, R6). The sample sizes are small, so treat this as a result for those tasks, not a general effect.

**Conditions and risks:**
- **Pin the Claude Code version.** The results are for 2.1.328. Hook behavior has changed between versions, and the project's own docs say each fact is checked on a specific version (`docs/verification/claude-code.md`). Run `noonsight check` after every Claude Code upgrade, and before rollout confirm your version matches the tested one or run the delivery benchmark on yours.
- **Known gaps in coverage.** Subagents that edit files were not measured. Neither were `/resume` inside a session, forks, plan mode, agent teams, `noonsight run`, routing, the classifier, or project configurations. If your team relies on any of these, test them first.
- **Known open risk: F3 and F4.** Both were fixed after the 300-session run, and the committed rate still reflects the build before those fixes. Their shortest reproductions pass, but the full run has not been repeated. Re-run the benchmark on your pinned version and build before relying on the 99.5% figure.
- **Unattended sessions and scopes.** Without a scope or `session.unattended_when_env`, the preset delivers little to a session. Set `unattended_when_env` for CI or batch use, and give interactive sessions a scope.
- **Installation changes every login.** `noonsight install` writes hooks for every Claude Code login on the account. On shared machines, that is a team-wide change. Also, there is no npm release yet, so install from a reviewed clone at a pinned commit. This directory is not a git repository, so you cannot check its provenance from here.
- **Keep the classifier off unless you accept the data path.** When enabled, it sends the first 4,000 characters of each task to a small model through the user's own Claude Code login. The hooks otherwise make no network calls.
- **Circular reference.** The benchmark measures delivery against noonsight's own resolver. A wrong model-to-rule mapping would not show in these numbers. Spot-check with `noonsight resolve <model> <scope>` and `noonsight models` before trusting the mapping.
- **Delivery is not obedience.** Rules are context, not enforcement. Rule effects vary by task and model, so keep verification in your review process rather than assuming the rules made the work correct.
- **Keep `CLAUDE.md` for what every model needs.** Use noonsight for per-model, per-scope or per-place rules, and for subagent coverage. `CLAUDE.md` still covers the main session well.

**Suggested rollout:** Pilot on one machine with two or three people for a few weeks. Pin the Claude Code version. Run `noonsight report` each week to find rules that never fire and to check subagent deliveries. Expand only after the re-run benchmark on your pinned build and your own subagent and file-edit tasks look right.

**What it guarantees:** Each Claude Code session and subagent that the hooks reach gets the rules written for the model it runs on, and every delivery is logged, with 99.5% of rule-due requests covered in 300 simulated sessions on Claude Code 2.1.328 against a local stub API. This rests on the project's hook-level interception and its fuzzing harness, which checks deliveries against noonsight's own resolver. It does not guarantee that the model follows the rules, that file-editing subagents or the unmeasured features are covered, or that the result holds on other Claude Code versions.

I did not run the test suite. This verdict relies on the committed documentation and result files, which I read but did not re-run.
