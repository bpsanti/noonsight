**Verdict:** Adopt with conditions. Run it as a pilot on a few teams first, and don't roll it out team-wide until you've checked it on your own Claude Code version and workloads.

**Reasons:**
1. Your mix of models and heavy subagent use is what it targets. The author's delivery benchmark (2026-11-23, Claude Code 2.1.330) reports 100% delivery on 3,090 requests with rules due, including 763 subagent requests. A `CLAUDE.md` reached 46.9% of subagent requests in the same comparison. The benchmark is self-run by the package author (`package.json`), so treat these numbers as the author's, not independently confirmed.
2. The delivery mechanism is narrow and local. It runs through Claude Code hooks, reads local files, and the hooks never block. The only network use is the classifier, which is off by default.
3. The effect on output quality is not shown. The paid pilot found no measurable difference between arms (133 of 144 without rules, 132 under noonsight, 133 with a `CLAUDE.md`). The README says no quality gain was shown.
4. Measured rule effects are narrow and mostly on the Sonnet and Haiku rules. `verify-changes` on Sonnet fix raised tests-after-edit from 0 of 30 to 29 of 30, but its mean cost rose from $0.0240 to $0.0505 per run. `carry-through` on Haiku triage showed no effect on finishing every part (6 of 40 against 2 of 40, p=0.26). Opus 5.5's `unattended-run` was never delivered in the rule experiment, so it is unmeasured.
5. The experiments are small. Most arms have 30–40 runs, the tasks are small, and the README says the results are not general effects.

**Conditions and risks:**
- **Pin and retest per Claude Code version.** Every result is tied to a version (2.1.330 for delivery, 2.1.329 for most rule effects). Hook behavior can change on an update, so re-run `noonsight report` and `noonsight resolve` after each upgrade.
- **Know the delivery gaps before relying on it for subagents.** Per the README, a workflow's agents receive nothing, and foreground agents of one type that need different rules receive nothing until their first Edit, Write or agent call. Plugins your organization syncs are not read, so their subagents stay on the parent's model. Agent teams and routing are not measured.
- **Compaction and resume.** A conversation compacted with no response since, and resumed without a model name, runs on Claude Code's default model, which noonsight cannot detect.
- **`/fork` is disabled in sessions started with `noonsight run`.** Teams that fork in those sessions will hit this.
- **Set `session.unattended_when_env`** to your CI or orchestrator variable. Otherwise, interactive sessions nobody is watching get the attended rules, and the preset's Opus and Fable attended rules ship off.
- **Cost.** Some rules raise cost (see the `verify-changes` example). Measure cost per task on your own workloads with `noonsight report`, and drop rules that don't change anything you can see.
- **Rules are context, not enforcement.** The guarantee covers delivery only. Whether a model follows a rule is a separate question.
- **Not verified here.** I read the README, the evidence summary and the rule-experiment summary. I did not install the package, run `npm test`, or check the author's claims against raw result files. The `docs/evidence.md` links point to result directories I did not open.

**What it guarantees:** Through Claude Code's hooks, noonsight puts each model's declared rules into the requests of every session and subagent running on that model, and re-delivers them when the model changes or the conversation is compacted, cleared, resumed or forked. This rests on the author's benchmark of 299 sessions (0 invariant breaks on Claude Code 2.1.330) and on Claude Code's hook behavior for the versions tested. It does not guarantee the model follows the rules.
