**Verdict: adopt with conditions**, as a time-boxed pilot on a few machines, not a team-wide rollout yet.

I read the README, the evidence and verification docs, the hook contract, the preset, the changelog and the benchmark results. I could not run the test suite or install it in this session, so the checks below are from reading, not from execution.

## Reasons

- **It fits your setup.** Its own README says to skip it if every session runs one model with fixed rules; you run four models with subagents, which is the case it is built for.
- **The gap it closes is real and measured.** A user `CLAUDE.md` reached 100% of the main conversation's requests but only 32.2% (39 of 121) of subagent requests, and never reaches the built-in Explore and Plan subagents. noonsight reached 100% of subagent requests in the same sequences.
- **It keeps other models' rules out.** Under noonsight 79.0% of the rule text in a request was written for that request's model, against 31.5% with a `CLAUDE.md` holding every model's rules.
- **The headline numbers check out.** I compared them with the committed result files: 3,219 of 3,221 requests on Claude Code 2.1.328, and 3,090 of 3,090 with 299 of 300 sessions completing on 2.1.330.
- **It is low-risk to run.** A search of `src/` found no network calls, and the only child processes are `ps`, `git`, `claude` and the optional watcher service. The hooks never block a call, and a repository's rules do nothing until each person runs `noonsight trust`.
- **It is very young.** `package.json` says 0.0.1 and private, it is not on npm, and the latest fixes are still under "Unreleased". Nine delivery failures (F1 to F9) were found and fixed in the last five days, five of them in today's run.
- **The outcome benefit is unproven.** In the 588-run pilot, tasks resolved at 133, 132 and 133 of 144 without rules, with noonsight and with a `CLAUDE.md`, and noonsight cost 7% more per run than no rules. `verify-changes` got Sonnet and Haiku to run tests (29 and 27 of 30 runs against 0), but roughly doubled the cost of a small fix, and all 600 runs passed their hidden check either way.
- **The preset alone gives your Opus and Fable interactive sessions nothing.** Their attended rules all ship off, so the value for those sessions comes from rules you write yourselves.

## Conditions and risks

Conditions:
- **Have rules that differ by model.** If you have nothing model-specific to say, keep using `CLAUDE.md`; leave shared rules there in any case.
- **Pin the tool and Claude Code.** Install from a fixed commit, and re-run its delivery corpus (`NOONSIGHT_LIVE_DELIVERY=1 npm run test:live`) before each Claude Code upgrade.
- **Start per-account.** Skip the `--managed` machine-wide install, which was never tested live, and leave routing and the classifier off, since neither was measured.
- **Review the log weekly.** Check `noonsight report` for `MISMATCH`, `calls-differ` and rules never delivered.
- **Run `npm test` yourselves before installing**, since I could not.

Risks:
- **Claude Code drift.** It relies on undocumented behaviour (`CLAUDE_CODE_SESSION_ATTENDED`, fork transcripts, subagent `.meta.json`), and each new version tested so far exposed new failures. A break is silent, with missing or wrong rules and no error.
- **Subagent gaps.** Workflow agents get nothing. Parallel same-type subagents needing different rules get nothing until their first edit or agent call. Split-pane agent teams are untested, and organisation-synced plugins are predicted on the parent's model.
- **Unlisted models.** In the pilot, Claude Code switched models by itself to Opus 4.8 and Sonnet 5 on one task; a model you have not declared gets a warning and no rules.
- **Overhead and footprint.** Each hook costs 50 to 90 ms of CPU on session starts, edits and agent calls. It edits every Claude Code login's `settings.json` and keeps state and a decision log under `~/.local/state/noonsight`.
- **Maintenance.** The project looks like a single author's work, and you would be running from a clone.

## What it guarantees

It guarantees delivery, not obedience: the rule text selected for a session's or subagent's model, scope and place is present in the requests. That rests on fuzzed sessions against a local stand-in API on Claude Code 2.1.328 and 2.1.330, judged against noonsight's own resolver, and on hook behaviours that Claude Code can change.
