**Verdict: adopt with conditions** — run it as a small pilot at a pinned commit, not a team-wide rollout yet.

I read the README, docs, changelog, CI config and the committed result files. I could not run the test suite (no shell in this session) and did not audit the source.

## Reasons

- **It fits your setup.** It delivers per-model rules to sessions and subagents through Claude Code hooks, and re-delivers after `/model`, `/compact`, `/clear`, resumes and forks.
- **The delivery evidence is strong where it was measured.** In the latest run (Claude Code 2.1.330), all 3,090 requests with rules due held them, including 763 of 763 subagent requests. The README says 0 of 300 sessions broke the invariant; the summary shows 299 of the 300 were measured.
- **A shared `CLAUDE.md` does worse on subagents.** In the same run it covered 46.9% of subagent requests (60 of 128) and never reached the built-in Explore and Plan subagents. It also gave every model the other models' rules.
- **No evidence it improves results.** In the 588-run pilot, tasks resolved were 133, 132 and 133 of 144 for off, noonsight and `CLAUDE.md`. Runs cost about 7% more with noonsight's rules.
- **The preset does little in interactive use.** Attended Opus and Fable sessions receive nothing by default. Sonnet and Haiku get `verify-changes` only after editing a tracked code file, and that rule roughly doubled the cost of a small fix.
- **It is very young.** `package.json` says 0.0.1 and private, it is not on npm, and the whole changelog is "Unreleased". Nine delivery bugs were found between 19 and 23 November; the last five were fixed in the build measured today.
- **It leans on undocumented Claude Code behaviour.** Examples are `CLAUDE_CODE_SESSION_ATTENDED`, fork transcripts and subagent metadata files. CI pins Claude Code 2.1.325, while the newest fixes rely on behaviour recorded on 2.1.330.

## Conditions and risks

Conditions:
- **You have rules that differ by model or by subagent.** If not, the project's own docs say a `CLAUDE.md` is simpler.
- **Start with two or three people.** Pin one commit and write your own rules rather than relying on the preset.
- **Check after every Claude Code update.** Run `noonsight check` and `noonsight report`; a new version is unverified until then.
- **Per-person setup is acceptable.** Each person installs from a clone and runs `noonsight trust` once per repository. The hook points at that clone by absolute path.
- **Your organisation allows user hooks.** Managed settings with `allowManagedHooksOnly` or `disableAllHooks` stop it.

Risks:
- **Failures are quiet.** Hooks always exit 0, so a break means missing or wrong-model rules; warnings and the log are the only signal.
- **Subagent gaps.** Workflow agents get nothing. Parallel foreground subagents of one type that need different rules get nothing until their first edit or agent call. Split-pane agent teams, routing and the classifier are unmeasured.
- **Model fallbacks.** In the pilot, Claude Code switched sessions to Opus 4.8 and Sonnet 5 on its own; noonsight sent only a note retiring the old rules, with no rules for the new model.
- **Overhead.** Each hook costs 50–90 ms of processor time, and a subagent start can wait up to 2 seconds more.
- **Single maintainer.** The repository names one author; a breaking Claude Code change may wait on one person.

## What it guarantees

It guarantees delivery, not obedience: each session and subagent gets the rules configured for the model it runs on. That rests on a fuzz benchmark against a stand-in API on one Claude Code version at a time, scored against noonsight's own resolver.
