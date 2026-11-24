**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines, with your own rules, not as a team-wide default yet.

I read the README, the evidence map, the preset sources, the delivery benchmark's failure and limit sections, and parts of the hooks doc. I did not run the test suite or audit the source, so the numbers below are the repository's own committed results, not something I reproduced.

## Reasons

- **It fits the gap your setup has.** With several models and many subagents, a shared `CLAUDE.md` reached only 46.9% of subagent requests (60 of 128) in its benchmark and never reaches Explore or Plan subagents. noonsight reached 100% (763 of 763).
- **It keeps other models' rules out.** Under a `CLAUDE.md`, only about a third of the rule text in a request was written for that request's model, against 78.6% under noonsight, at roughly a third of the added characters (1,343 against 4,472).
- **Some rules change behaviour, on small tasks.**
  - `verify-changes`: Sonnet ran tests after a one-file fix in 29 of 30 runs against 0 of 30 without it; Haiku in 27 of 30 against 0 of 30.
  - `carry-through`: Sonnet finished a 13-ticket backlog in 32 of 40 runs against 9 of 40.
  - `low-context-report`: Fable wrote shorter sentences in its reports.
- **No quality gain is shown.** The paid pilot resolved 133 of 144 tasks without rules, 132 under noonsight and 133 with a `CLAUDE.md`. In the fix and bug runs, all 600 passed their hidden check with or without rules.
- **Out of the box it does little for Opus and Fable.** Their attended-session rules ship off, no Opus rule has a measured effect, and Opus subagents receive nothing from the preset. Most scoped rules stay dormant unless you set `NOONSIGHT_SCOPE` or declare matchers, and subagents never inherit the session's scope.
- **It is low-risk to try.** Hooks always exit 0, never block a call, and use no network with the classifier off. There are no runtime dependencies, a repository's config does nothing until each person runs `noonsight trust`, and `noonsight uninstall` or `NOONSIGHT_DISABLE=1` backs it out.
- **It is very young.** This is version 0.1.0 from a single author, and all the evidence dates from 16 to 23 November 2026. Its own fuzzer found nine delivery failures in that week, five of them fixed on the day of the current run.

## Conditions and risks

**Conditions**
- Write your own per-model rules and scopes; the preset alone will not justify the install for a team heavy on Opus and Fable.
- Pin a Claude Code version during the pilot and rerun `npm run test:live` and the delivery corpus before upgrading. The current delivery results hold for 2.1.330 only.
- Set `session.unattended_when_env` for orchestrated sessions, or they count as attended and miss the unattended rules.
- Review `noonsight report` weekly and drop rules that never fire or change nothing you can see.
- Measure on your own tasks before rollout; the authors say their tasks are small and not general effects.

**Risks**
- **Claude Code drift.** It relies on undocumented behaviour: the `CLAUDE_CODE_SESSION_ATTENDED` variable, transcript layout, and reading the parent `claude` command line via `ps`. A release can break delivery silently.
- **Unmeasured or uncovered paths.** Workflow agents get nothing. Agent teams, routing, the classifier and `opusplan` are not measured, and subagents from plugins it cannot read are predicted on the parent's model.
- **Exact model IDs.** A new model version, or an automatic fallback such as the pilot's switches to `claude-opus-4-8`, gets no rules until someone declares it.
- **Cost.** `verify-changes` roughly doubled the cost of a small Sonnet fix ($0.0505 against $0.0240). The pilot overall rose about 7% ($0.155 against $0.145 per run), still below the `CLAUDE.md` arm ($0.173). Each hook run adds 80 to 150 ms of processor time.
- **Self-referential evidence.** The benchmark uses a stub API and checks delivery against noonsight's own resolver, so a wrong resolution would not show.

## What it guarantees

noonsight guarantees delivery, not obedience: the rules declared for a model are put into the requests of each session and subagent running on it, and again after a model switch, compaction, clear, resume or fork. That rests on Claude Code's hooks behaving as they did on the version tested (0 of 299 sessions broke this on 2.1.330, against a stub API).
