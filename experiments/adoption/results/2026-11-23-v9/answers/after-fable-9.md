**Verdict:** adopt with conditions, as a time-boxed pilot on a few machines rather than a team-wide rollout.

This rests on the README, the hooks and install docs, the evidence map, the preset and its sources, and the changelog. I did not read the source code or raw result files, and I could not run the test suite in this session, so the numbers below are the project's own claims.

**Reasons:**
- **It fits the gap you actually have.** A `CLAUDE.md` reached every main-conversation request in their benchmark (448 of 448) but only 46.9% of subagent requests (60 of 128), and never reaches the built-in Explore and Plan subagents. noonsight reached 763 of 763 subagent requests.
- **It keeps other models' rules out.** With a shared `CLAUDE.md`, only about a third of the rule text in a request was written for that request's model, against 78.6% under noonsight. It also added fewer characters per request (1,343 against 4,472).
- **Some rules change behaviour, measurably.** With `verify-changes`, Sonnet ran tests after a one-file fix in 29 of 30 runs against 0 of 30, and Haiku in 27 of 30 against 0 of 30. With `carry-through`, Sonnet finished a 13-ticket backlog in 32 of 40 runs against 9 of 40.
- **No quality gain is shown.** Every run passed its hidden check with or without rules (600 of 600), and a pilot on public tasks saw no difference (133, 132 and 133 of 144). The rules change process, not measured outcomes.
- **The preset does little for your Opus and Fable sessions.** An attended session on either receives nothing until you enable a rule. No Opus rule has a measured effect, and Fable's only one is shorter report sentences.
- **It is low-risk to try.** It has no runtime dependencies, is MIT-licensed, reads only local files and never blocks a call. `noonsight uninstall` removes its hooks and `NOONSIGHT_DISABLE=1` silences a session.
- **It is very young.** This is version 0.1.0 from a single author, with all evidence gathered between 2026-11-16 and 2026-11-23. Its own benchmark found nine delivery failures in that week, all reported as fixed.

**Conditions and risks:**
- **Write your own rules.** The value for a team like yours comes from per-model and per-subagent rules you write, not from the preset. If you have no rules that differ by model, a `CLAUDE.md` is simpler, and the README says so.
- **Pin and re-check on Claude Code upgrades.** Delivery was measured on 2.1.330 only, and several mechanisms rely on undocumented Claude Code behaviour (fork detection, the headless flag, subagent metadata). Run `noonsight check` and `noonsight report` after each upgrade.
- **Known gaps in delivery:**
  - Workflow agents get nothing.
  - Parallel same-type subagent calls that need different rules get nothing until their first Edit, Write or agent call.
  - Subagents from organisation-synced plugins may be predicted on the wrong model.
  - Agent teams, routing and the classifier are unmeasured.
- **Leave routing and the classifier off.** Routing rewrites agent calls, which in auto mode gets the other calls of the same response refused and retried. The classifier sends task text to a model over the network.
- **Cost goes up where rules bite.** `verify-changes` roughly doubled the cost of a small Sonnet fix ($0.0505 against $0.0240). Each hook run adds about 80 to 150 ms of processor time.
- **Scoped rules stay dormant by default.** The preset's scopes ship no matchers, so scoped rules reach a session only if you set `NOONSIGHT_SCOPE`, declare matchers or use the classifier.
- **Environment limits.** It needs Node.js 20 or newer on macOS or Linux; Windows is unsupported. Managed settings such as `allowManagedHooksOnly` or `disableAllHooks` stop the per-account install.
- **It writes to each person's settings.** The install edits every Claude Code login's `settings.json` and keeps a decision log, with file paths and session ids, under `~/.local/state/noonsight/`. Repository rules need each person to run `noonsight trust` once.
- **Before the pilot, run `npm test` yourselves.** It is meant to recompute every published number from the raw files, which I could not confirm here.

**What it guarantees:** noonsight guarantees that the rules declared for a model are placed in the requests of each session and subagent running on that model, and re-delivered on model switch, compaction, clear, resume or fork. That is delivery, not obedience, and it rests on Claude Code's hook behaviour as measured on version 2.1.330 against a stand-in API, within the gaps listed above.
