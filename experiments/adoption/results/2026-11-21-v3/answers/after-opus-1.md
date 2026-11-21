**Verdict: adopt with conditions.** Run it as a short pilot, not as a team-wide default.

**Reasons**

1. **It fixes a real gap in how you work, and the measurements show it.** You mix four models and use a lot of subagents, and that's where the native options fall short. In the project's delivery benchmark (Claude Code 2.1.328, against a local stand-in for the API), a user `CLAUDE.md` gave subagent requests their model's rules only 32.2% of the time. It never reaches the built-in Explore and Plan subagents, and it sends every model the other models' rules too: only 31.6% of the rule text was meant for the model receiving it. noonsight got 100% on the same 60 sequences and 99.5% (3,199 of 3,216 requests) across 300 random sessions (`docs/evidence.md` D2, D10, D12).
2. **The default rules do almost nothing for normal interactive sessions.** In `presets/claude/preset.json`, a watched session gets a rule only if it has a task scope (`NOONSIGHT_SCOPE`) or matches a rule's trigger. The preset defines no automatic scope matchers, and its only trigger is a code edit, which brings Sonnet's and Haiku's `verify-changes`. So an interactive Opus or Fable session with no scope gets nothing. Subagents without a scope get very little: Sonnet and Haiku get `carry-through`, Fable gets `low-context-report`, and Opus gets nothing. The README says this itself (line 41).
3. **No better results have been shown on realistic work.** In the benchmark pilot, 132 of 144 tasks passed with noonsight and 133 of 144 without, at about 7% higher cost per run (`experiments/benchmark/results/2026-11-19/summary.md`). The rule-by-rule effects are real but narrow. `verify-changes` made Sonnet and Haiku run the tests after a one-file fix (29 and 27 of 30 runs, against 0 of 30 without rules), but it roughly doubled Sonnet's cost on that task ($0.024 to $0.0505). All 600 runs passed their hidden checks with or without rules (R8).
4. **It is very new.** It is version 0.0.1, and everything in the changelog is dated 14–20 November 2026. It isn't on npm yet: the npm name holds an empty placeholder, so `npx noonsight` won't install the tool today. You install it by cloning the repo. It has been measured on one Claude Code version (2.1.328) and depends on about 50 hook behaviours that were each checked on a specific version (`docs/verification/claude-code.md`).
5. **It is low-risk to run.** According to its docs, the hooks always exit 0, never block and don't use the network (the classifier is the one exception, and it's off by default). Each hook run takes about 60–120 ms. `noonsight uninstall` removes everything, and `NOONSIGHT_DISABLE=1` turns it off for a single session.

**Conditions and risks**

Conditions:
- **Pin a commit, install from source, and review it first.** Don't use `npx noonsight` until a real version is published, because the name is currently a placeholder.
- **Pin your Claude Code version for the pilot.** Each time you upgrade Claude Code, rerun the delivery corpus (`NOONSIGHT_LIVE_DELIVERY=1 npm run test:live`). Hook behaviour changes between versions, and the guarantee was measured on only one.
- **Plan to write your own rules or add scopes.** With the preset alone, most of your sessions get nothing. Use `session.unattended_when_env` for automated runs, `NOONSIGHT_SCOPE` or your own matchers for interactive work, and `all_models.add` or `models.<id>.add` for team rules that really do differ by model. Rules every model should get stay in `CLAUDE.md`.
- **Decide in advance what counts as success.** Use `noonsight report` to see what was actually delivered, and compare a behaviour you care about (for example, tests run after edits) against your cost per session. Drop any rule that doesn't change anything you can see.
- **Don't turn on what wasn't measured.** Routing, the classifier and the login watcher were never part of the delivery benchmark, so leave them off.

Risks:
- **Wider install than you might expect.** `noonsight install` writes hooks into every Claude Code config directory it finds in your home directory, not just `~/.claude`.
- **Known gaps:**
  - Several parallel subagent calls of the same type that should get different rules all get only the rules they have in common.
  - A conversation that was compacted and then resumed without naming a model can get the wrong model's rules.
  - The fixes for the last two bugs the fuzzer found (F3, F4) haven't been re-fuzzed. Only their minimal reproductions were checked.
  - Never measured: `/resume` inside a session, forks, plan mode, agent teams, and subagents that edit files. Plan mode and agent teams may matter for your team.
- **Cost.** Rules make the model do extra work. `verify-changes` doubled the cost of a small Sonnet fix, and the benchmark showed no quality gain to justify it.
- **Single-maintainer project.** If Claude Code changes how hooks behave and nobody updates noonsight, deliveries could break without any visible error. The decision log records only what the hook returned, not what actually reached the model.

**What it guarantees:** It aims to put each model's configured rules (and no other model's rules without a note retiring them) into every request of a session and its subagents. Being delivered doesn't mean being followed: the rules are context the model can still ignore. The 99.5% figure comes from 300 fuzzed sessions on Claude Code 2.1.328 against a stand-in API, checked against noonsight's own rule resolver, and it depends on hook behaviours confirmed only on Claude Code 2.1.325–2.1.328.
