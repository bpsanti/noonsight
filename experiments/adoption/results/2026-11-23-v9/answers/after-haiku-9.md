**Verdict: Adopt with conditions.** Pilot it on a few people and a few repositories first, and roll it out only if your own tasks show it helps.

**Reasons**

1. **Subagent coverage is the strongest case for it.** In the 2026-11-23 benchmark, a user `CLAUDE.md` reached 46.9% (60 of 128) of subagent requests with rules due. `.claude/rules` reached the same 46.9%, and a skill reached 0%. noonsight reached 100% (763 of 763). Your team starts many subagents, so this gap matters most for you. Source: `docs/evidence.md` D20, D25, D28 and the benchmark summary.
2. **It targets your model mix.** Each session and subagent gets the rules for the model it actually runs on, and they are re-delivered after `/model`, compaction, `/clear`, resume and fork. A single `CLAUDE.md` cannot do that across Opus, Sonnet, Haiku and Fable. The benchmark also found that `CLAUDE.md` and `.claude/rules` hand every model the other models' rules (D30). Rules that reach the wrong model are noise, and that noise is what noonsight removes.
3. **The delivery claim has measurements behind it.** The delivery run used 300 generated sessions on the four models, with 299 completed and 0 invariant breaks. It covered forks, `/resume`, plan mode and subagents that edit files. The run was on Claude Code 2.1.330, and the harness drove real interactive sessions against a local stand-in for the Messages API.
4. **The benefit on task quality is not shown.** The paid pilot found no measurable difference in pass rates: 133 of 144 without rules, 132 of 144 under noonsight, 133 of 144 with a `CLAUDE.md`. The measured rule effects are narrow: `verify-changes` on Sonnet and Haiku, `carry-through` on Sonnet, and `low-context-report` on Fable. Opus rules have no measured effect, and the Opus and Fable attended rules ship off. Adoption is therefore justified by delivery reliability, not by a proven quality gain.
5. **Cost is modest.** On the 2026-11-23 run, noonsight added about 1,343 characters per request, against 4,472 for a `CLAUDE.md` carrying every model's rules. That is about 5.4% of request text, against 15.4%.

**Conditions and risks**

- **Pin the Claude Code version and test each upgrade.** Every result is tied to a version: delivery to 2.1.330, rule effects to 2.1.328/2.1.329, the pilot to 2.1.326. The docs say hook behavior can change between versions. Before anyone upgrades Claude Code, run `noonsight check` and a short delivery check.
- **Check the install footprint before it goes to every login.** `noonsight install` adds hooks to every Claude Code login on the account, and `--managed` covers the whole machine. The package is version 0.1.0, described as the first published version, so it has little track record. Install the pinned version from npm, review it, and roll it out one login at a time. Confirm `noonsight uninstall` works before you depend on it.
- **Keep the unmeasured parts off or verified.** Routing, the classifier, agent teams and the watcher are off by default and not measured. The classifier sends the first 4,000 characters of a task to a small model through each person's login, which may conflict with your data policy. Leave it off unless you have reviewed that.
- **Know the known gaps.**
  - Workflow agents receive no rules.
  - Foreground calls of one type that need different rules give their subagents nothing until their first Edit, Write or agent call.
  - Plugins that noonsight does not read, such as organization-synced plugins, leave their subagents on the parent's model.
  - A compacted or resumed session with no model named runs on the default model, which noonsight cannot detect.
  - `/fork` is unavailable in sessions started with `noonsight run` and rules.
- **Set the session place for unwatched runs.** Interactive sessions count as attended unless `session.unattended_when_env` names your CI or orchestrator variable. Headless runs (`claude -p`, the Agent SDK) default to unattended. Set this, or the wrong rules will reach your automation.
- **Write your own rules with measurement.** Use `noonsight resolve` and `noonsight report` to check what each model receives. Drop any rule your own tasks show no effect for, and keep long rule text in files.
- **The evidence comes from the project's own benchmarks.** The delivery numbers are the tool's own measurements, and the test suite recomputes them from committed raw files. Before a broad rollout, run one check of your own: have a few Sonnet and Haiku sessions with subagents, with and without noonsight, and compare what each model reports it received.

**What it guarantees:** noonsight puts the rules declared for a model into the requests of each session and subagent running on that model, and re-delivers them when the model changes or the conversation is compacted, cleared, resumed or forked, as checked in 299 benchmark sessions on Claude Code 2.1.330 with a stand-in API. This rests on Claude Code's hook mechanism and noonsight's own decision log, not on any model following the rules, which the project says is "delivery, not obedience."

I did not install or run the tool; this verdict is from reading the README, changelog, evidence file, delivery benchmark summary and hooks documentation.
