**Verdict: adopt with conditions.** Pilot it with your own rules on a few machines; do not roll it out team-wide as it stands.

I read the README, the hook and install docs, the evidence map and the experiment results. I did not run the test suite or audit the source in `src/`, so the numbers below are the repository's own.

## Reasons

- **It solves a problem your setup has.** In its delivery benchmark, a `CLAUDE.md` holding every model's rules reached 32.2% of subagent requests (39 of 121) and never reached the built-in Explore and Plan subagents. noonsight reached 100% of them on the same sequences.
- **It keeps other models' rules out.** Under noonsight 79% of the rule text in a request was written for that request's model, against 31.5% with a `CLAUDE.md`. That matters when four models share one set of instructions.
- **The preset gives little to attended sessions.** On Opus 5.5 and Fable 5.2 an attended session receives nothing by default. On Sonnet 5.5 and Haiku 5.5 it receives `verify-changes` after the first edit of a tracked code file. Most of the value would come from rules you write yourselves.
- **Its own pilot shows no gain in task outcomes.** Across 588 paid runs, 133 of 144 verified tasks resolved without rules, 132 with noonsight and 133 with a `CLAUDE.md`. noonsight cost 7% more per run than no rules, and the `CLAUDE.md` cost 19% more.
- **Some individual rules do change behaviour, at a price.** `verify-changes` moved Sonnet from 0 of 30 to 29 of 30 runs that ran the tests after a one-file fix. The run cost rose from $0.024 to $0.0505. These are small tasks at 30 to 40 runs per arm.
- **It is very young.** The package is version 0.0.1, marked private, not on npm, and installed from a clone of one author's repository. The fuzzer found nine delivery failures in roughly a week, all fixed, the last five in the run dated today.
- **It is low-risk to try.** The hooks never block a call, use no network by default, have no runtime dependencies, and `noonsight uninstall` removes them.

## Conditions and risks

Conditions:
- **Write your own rules.** Decide which rules differ by model before installing; if none do, a `CLAUDE.md` is simpler, as the README itself says.
- **Pin and re-verify.** The delivery results are for Claude Code 2.1.328 and 2.1.330 only. Rerun the delivery corpus on each Claude Code version you move to.
- **Check your organisation's settings.** Managed settings that turn off user hooks stop it, and server-managed settings make Claude Code ignore the machine-wide install. Each person then installs per account, and runs `noonsight trust` once per repository.
- **Review the source before installing.** The hooks run on every session, and I have not audited the code.

Risks:
- **Reliance on undocumented behaviour.** Fork detection, the headless flag and subagent metadata are all things Claude Code does not document, so an update can break delivery silently.
- **Subagent gaps.** Workflow agents get nothing. Parallel foreground calls of one type that need different rules get nothing until their first edit or agent call. Subagents from organisation-synced plugins are predicted on the parent's model.
- **Scoped rules rarely reach subagents by default.** The preset's scopes have no match patterns, so you must write patterns or turn on the classifier. The classifier sends the first 4,000 characters of each task to a model and can add up to 8 seconds.
- **Unmeasured paths.** Agent teams, routing and the classifier are not in the benchmark. Windows is not supported for the machine-wide install.
- **The log can overstate.** The decision log records what the hook returned, not what reached the model.

## What it guarantees

noonsight guarantees delivery, not obedience: each session and subagent gets the rule text for the model it runs on. That rests on a fuzz benchmark of 300 sessions from one seed against a stand-in API on two Claude Code versions, judged against noonsight's own resolver.
