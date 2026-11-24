**Verdict: adopt with conditions.** Treat it as a time-boxed pilot on a pinned Claude Code version, not a team-wide rollout yet.

**Reasons**

1. **It fixes a real gap for a team like yours.** You run four models and lots of subagents. Without noonsight, a user `CLAUDE.md` held the rules in only 46.9% (60 of 128) of subagent requests. It also put other models' rules, with nothing marking them as not applying, into 619 requests. With noonsight, the same benchmark shows 100% (763 of 763) for subagents and 0 such cross-model leaks. I checked the headline numbers (3,090 of 3,090, 763 of 763, 299 sessions) against the raw `summary.json`, and they match.
2. **The evidence is careful and honest about itself.** Every number links to a raw file with its date and Claude Code version, and the tests recompute each one. The README states the limits up front. It reports nine bugs (F1–F9) the benchmark found, and it does not claim the tool makes the work better.
3. **Better work is not shown.** In the paid pilot, tasks passed at about the same rate with no rules (133 of 144), with noonsight (132) and with a `CLAUDE.md` (133). Measured effects exist only for `verify-changes` (Sonnet, Haiku), `carry-through` (Sonnet) and `low-context-report` (Fable), all on small tasks. **No Opus rule has any measured effect.**
4. **Out of the box, it does little in your interactive sessions.** Opus and Fable preset rules for sessions someone is watching ship turned off. Sonnet and Haiku get their scoped rules only when a scope is set. You'd have to configure it to get value there.
5. **It costs money where it works.** On one small fix, `verify-changes` about doubled Sonnet's cost per run ($0.024 → $0.0505). Each hook run also takes 80–150 ms of CPU.
6. **It's very young and depends on a version.** Every result is from 2026-11-16 to 2026-11-23, and the current delivery evidence covers only Claude Code 2.1.330. Nine delivery bugs turned up and were fixed in that single week. The tool depends on undocumented hook details (for example, the subagent metadata file and how a fork's record is found) that Claude Code can change.

**Conditions and risks**

- **Conditions:**
  - Pin Claude Code. On each upgrade, re-run `npm run test:live` and, ideally, the delivery benchmark before moving the team.
  - Install globally with `npm install -g`, not `npx`. Hooks that run from npm's cache stop delivering once that cache is cleared.
  - Set `session.unattended_when_env` for your orchestrators.
  - Start with the rules that have measured effects. Measure your own rules before relying on them, and drop any that change nothing you can see.
  - Watch `noonsight report` and the `MISMATCH` warnings.
  - Have someone review the hook code before rollout. `noonsight install` adds the hooks to every Claude Code login on the account, and they then run in every session. I did not audit the source or run the test suite.
- **Known gaps that could hit you:**
  - A workflow's agents get nothing.
  - Subagents from plugins noonsight doesn't read, such as ones your organization syncs, are assumed to run on their parent's model and may get the wrong rules.
  - Agent teams in split panes are unchecked, and agent teams, routing and the classifier aren't measured at all.
  - When several subagents of the same type start at once and need different rules, they get nothing until their first Edit, Write or agent call.
  - `opusplan` can't be told apart.
  - `/fork` doesn't work in sessions started with `noonsight run` with rules.
  - A conversation compacted and resumed without naming a model may get the wrong model's rules.
- **Limits of the benchmark itself:** it used a stand-in API, so no model answered. It also checks delivery against noonsight's own rule resolver, so a bug in that resolver wouldn't show up.
- **Other:** the optional classifier, off by default, sends the first 4,000 characters of a task to a model through your Claude Code login.

**What it guarantees:** It guarantees delivery, not obedience: each session and subagent gets the rules you declared for the model it actually runs on, including after model switches, compaction, `/clear`, resume and fork. That rests on Claude Code's hooks behaving as they did on version 2.1.330, on noonsight correctly predicting which model each subagent will use, and on a benchmark with a stand-in API that checks against noonsight's own resolver.
