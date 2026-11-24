**Verdict: adopt with conditions.** Run it as a time-boxed pilot. Don't roll it out to the whole team yet.

**Reasons**

1. **It's built for how you work.** You run four different models and use a lot of subagents, which is exactly the case it targets. Its delivery benchmark found that a user `CLAUDE.md` holding every model's rules reached only 46.9% (60 of 128) of subagent requests. It also handed every model the other models' rules. A `CLAUDE.md` never reaches the built-in Explore and Plan subagents at all (README lines 39–47, evidence D25–D30). noonsight's own README says to skip it if everyone uses one model with fixed rules. That isn't your situation.
2. **The delivery claim is well tested.** The benchmark used real interactive Claude Code sessions against a stand-in API. 0 of 299 sessions broke the rule-delivery invariant, and 3,090 of 3,090 requests that were due rules had them. Each number in the README points to a raw results file, and I confirmed the cited files exist (`experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/`). The benchmark found nine of noonsight's own bugs (F1–F9) and documents each fix.
3. **Nobody has shown it makes the work better.** It reliably puts rules in front of the model, but that doesn't prove better results. In a paid pilot, tasks passed 133/144 with no rules, 132/144 under noonsight and 133/144 with a `CLAUDE.md` (B1). In another experiment, all 600 runs passed with or without rules (R8). The measured effects are behaviour changes on small tasks, such as Sonnet running tests after an edit 29/30 vs 0/30. Opus 5.5 has no rule with a measured effect.
4. **The default preset does little for interactive Opus and Fable sessions.** Their rules for watched (interactive) sessions ship turned off, so those sessions get nothing until you enable rules or write your own (README lines 50–55). The value depends on your team writing rules.
5. **It's very new and depends on undocumented Claude Code behaviour.** It's version 0.1.0, and every result is dated 2026-11-16 to 2026-11-23, so all of it is from the last week. It relies on undocumented internals such as `CLAUDE_CODE_SESSION_ATTENDED`, `forkedFrom`, the background job's `state.json` and the subagent metadata's `toolUseId`. The README says each result "holds for the version it ran on": 2.1.330 for delivery.
6. **It looks safe to run.** Its hooks never block or deny anything, always exit 0 and have a 10-second timeout. They use no network unless you turn on the optional classifier, which is off by default. There are no runtime dependencies and no npm install scripts. It's easy to undo with `NOONSIGHT_DISABLE=1` or `noonsight uninstall`.

**Conditions and risks**

- **Pin versions.** Pin the noonsight version and keep Claude Code close to 2.1.330. Re-run `noonsight check` and review `noonsight report` after every Claude Code upgrade. A hook change could silently stop deliveries, and the per-event log is the only way you'd notice.
- **Write and measure your own rules.** Only adopt rules that show an effect on your own tasks. Its own docs say "a rule of your own has none until you measure it." Otherwise you pay extra tokens for no proven gain.
- **Mark unwatched sessions.** For interactive sessions nobody watches, set `session.unattended_when_env` to your orchestrator's variable. Give Sonnet and Haiku sessions a scope via `NOONSIGHT_SCOPE`, or their scoped rules never arrive.
- **Accept the known gaps:**
  - Workflow agents get nothing.
  - Subagents from plugins your organization syncs are guessed to run on their parent's model. noonsight only flags a wrong guess after the subagent has started.
  - When several subagents of one type that need different rules start at once, they get nothing until their first Edit, Write or agent call.
  - Agent teams, routing and the classifier were not measured.
  - `/fork` doesn't work in sessions started with `noonsight run`.
- **Install with `npm install -g`, not `npx`.** With `npx`, deliveries stop once npm's cache is cleared.
- **Evidence limits:**
  - The benchmark checks delivery against noonsight's own resolver, so a wrong choice of rules wouldn't show up. Only a failed delivery would.
  - Its stand-in API never compacts on its own and gives fixed answers.
  - The project is a single maintainer's.
  - I didn't run the test suite. I read the docs and confirmed the result files exist, but didn't recompute the numbers.

**What it guarantees:** It guarantees delivery, not obedience: the rules you declare for a model are put into the requests of each session and subagent running on that model, and again after a model switch, compaction, clear, resume or fork, outside the listed gaps. That rests on Claude Code's hooks behaving as recorded on version 2.1.330 and on noonsight correctly predicting each subagent's model. It was measured against a stand-in API, not on whether the models follow the rules.
