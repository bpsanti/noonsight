**Verdict: adopt with conditions.** Pilot it on one or two repositories before rolling it out to the whole team.

**Reasons**

- **It addresses a real gap in your setup.** Your team runs four models and many subagents. In the delivery benchmark, `CLAUDE.md` reached 46.9% of subagent requests that had rules due (60 of 128), while noonsight reached 100% (763 of 763). A `CLAUDE.md` also sends every model the other models' rules (about 4,472 characters added per request, against 1,343 for noonsight).
- **Its coverage holds across the lifecycle events your team uses.** The benchmark's 299 sessions on Claude Code 2.1.330 covered `/model`, `/compact`, `/clear`, resumes, forks, plan mode and subagents that edit, with 0 violations of its invariant. Nine earlier failures (F1 to F9) were found and fixed, and each has a reproduction in the corpus.
- **The model-switch behaviour matters for you.** The paid runs show Claude Code switching sessions to other models automatically (Opus 5.5 and Fable 5.2 both went to `claude-opus-4-8`). A per-model rule system is the case where this matters most, and noonsight re-delivers rules on each switch.
- **Setup is light and reversible.** It has no runtime dependencies, `noonsight uninstall` removes the hooks, and hooks never block a session.

**Conditions and risks**

- **Do not sell it as a quality gain.** The only quality test found no difference: 133 of 144 runs passed without rules, 132 of 144 with noonsight, and 133 of 144 with a `CLAUDE.md`. Rule effects were measured only for `verify-changes` and `carry-through` on Sonnet and Haiku, on small tasks. Opus and Fable rules have no measured effect. Judge each rule you add by measurement (`noonsight report` shows delivery only).
- **Cost goes up on Sonnet.** Input tokens rose about 28% on Sonnet 5.5 (121k to 155k per run), and cost per run rose from $0.070 to $0.086 in the benchmark. Fable and Opus rose less, and Haiku barely changed.
- **Pin the Claude Code version and re-check after each upgrade.** Every result is tied to a version (2.1.328 to 2.1.330). Run `noonsight check` and `noonsight report` after any upgrade.
- **Known gaps to confirm against how your team works:**
  - Foreground agent calls of different types that need different rules leave their subagents with none until their first Edit, Write or agent call.
  - A plugin that your organization syncs leaves its subagents predicted on the parent's model.
  - Agent teams, routing and the classifier are not measured.
  - Skills are not covered (0 of 579 requests).
  - `/fork` is unavailable in sessions started with `noonsight run`.
  - A conversation compacted with no later response and resumed with no model named runs on Claude Code's default model, which noonsight cannot detect.
- **Keep the classifier off unless you approve it.** When enabled, it sends the first 4,000 characters of each task to a model through your Claude Code login.
- **Configure unattended sessions.** Interactive sessions count as attended unless `session.unattended_when_env` names your CI or orchestrator variable. Opus 5.5 and Fable 5.2 ship their attended rules off, so those sessions get nothing from the preset until you enable them.
- **Single maintainer, version 0.1.0.** The benchmarks are the author's own, run on a local stand-in for the Messages API. I did not run them, so the numbers are as reported and have not been independently checked. The benchmark ran real interactive Claude Code sessions, but no model answered.
- **Install scope.** `noonsight install` adds hooks to every Claude Code login on the account. Tell the team that, and install per login if you prefer.
- **Keep shared rules in `CLAUDE.md`.** The project's own guidance recommends this for rules that every model should follow.

**Practical pilot plan**

1. Install on two developer machines and one CI or headless host, with `unattended_when_env` set.
2. Commit `.noonsight/noonsight.json` in one repository, and have each person run `noonsight trust`.
3. Run `noonsight report` each week, and check that subagent coverage is what you expect.
4. Re-evaluate after a month, using your own tasks, before deciding on wider rollout.

**What it guarantees:** noonsight puts the rules declared for a model into the requests of each session and subagent that runs on that model, and re-delivers them when the model changes or the conversation is compacted, cleared, resumed or forked. This rests on Claude Code's hook interface and on the maintainer's delivery benchmark (299 sessions on 2.1.330, against a local stub). It does not guarantee that the model follows the rules.

I read the README, the delivery and rule-effect summaries and the delivery benchmark's README. I did not read the source code or run the test suite, so the claims above rest on those documents.
