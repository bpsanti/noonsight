**Verdict:** Adopt with conditions. Pilot it on the models and subagent paths your team actually uses before a rollout.

**Reasons:**
- It solves a real gap in your setup. In the delivery benchmark (Claude Code 2.1.330, 299 sessions), a user `CLAUDE.md` reached 46.9% of subagent requests that had rules due (60 of 128). Explore and Plan subagents never receive it, per the README. Your many-subagent workflows are where that matters.
- A `CLAUDE.md` also gives every model the other models' rules. The benchmark counts 619 requests with another model's rules and no note. noonsight reported 0 in the same runs.
- Native per-model options are weaker. A skill per model got 0% delivery in the benchmark. `.claude/rules` got 76.3% overall.
- Cost is higher on the cheaper models. In the paid-run summary (both rounds), input tokens per run rose from 253k to 323k on Haiku, and cost per run rose from $0.071 to $0.084 on Sonnet (about 18%). Opus was flat and Fable rose about 9%. This is a cost of adding the rules, not a quality gain.
- The quality benefit is not shown. A paid pilot on public tasks found 133/144 passing without rules, 132/144 with noonsight, and 133/144 with a `CLAUDE.md`. The rule-effect experiments cover small tasks only, and only a few rules show a measured effect alone (`verify-changes` on Sonnet and Haiku, `carry-through` on Sonnet, `low-context-report` on Fable).

**Conditions and risks:**
- Adopt only if you have, or will write, rules that differ by model, task, or place. If every model should get the same rules, the README's own advice is to use `CLAUDE.md`.
- Check the Claude Code version. The results were measured on 2.1.326 to 2.1.330. Each result is tied to the version it ran on, so re-run `noonsight check` and the delivery check after Claude Code updates.
- Expect silent model switches. In the paid runs, Opus 5.5 and Fable 5.2 sessions auto-switched to `claude-opus-4-8`. noonsight re-delivers rules on a switch, which helps, but your costs and behavior will change without anyone choosing it.
- Known gaps that affect you:
  - A workflow's agents get no rules.
  - Foreground agents that need different rules get nothing until their first Edit, Write, or agent call.
  - Plugins it does not read (such as ones an organization syncs) leave their subagents on the parent's model.
  - Agent teams, routing, and the classifier are not measured.
  - `/fork` is unavailable in sessions started with `noonsight run`.
  - Resuming a compacted session with no model named can fall back to the default model, which noonsight cannot detect.
- Preset defaults may not fit you. Opus's and Fable's attended rules ship off. Sonnet and Haiku need a scope for their scoped rules. Headless runs are treated as unattended. Set `session.unattended_when_env` for your CI and orchestrators, or interactive sessions nobody watches will be misclassified.
- Security: the tool installs hooks into every Claude Code login on the account, and rule text goes into model context. Repo-level `.noonsight/noonsight.json` changes nothing until someone runs `noonsight trust`. Review those files like code, because a committed rule file is an instruction to every model that reads it. The default install is `npm install -g`; pin the version, and check the package source before installing.
- Measurement is the authors' own. The delivery benchmark used a local stub for the Messages API, so no model answered, and the paid results are from the authors' experiments. I did not run `npm test` or re-compute the numbers from the raw files, so treat these figures as reported, not independently verified.

**What it guarantees:** Through Claude Code's hooks, the rules declared for a model are added to the requests of each session and subagent running on that model, and re-added when the model changes or the conversation is compacted, cleared, resumed, or forked. This rests on the hook events and decision log, and it was measured in the benchmark on Claude Code 2.1.330, with the known gaps above. It is delivery, not obedience: the tool does not guarantee the model follows a rule, and the README says so.
