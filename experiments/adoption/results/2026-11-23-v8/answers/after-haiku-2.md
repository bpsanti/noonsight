**Verdict:** Adopt with conditions. Pilot it on two or three machines first, pinned to one Claude Code version.

**Reasons:**
- It targets your main gap. Rules per model only reach subagents through hooks, and the repo's measurements show the native routes falling short. In the current run (Claude Code 2.1.330), requests with rules due got them 100% of the time (3,090 of 3,090) and subagent requests 100% (763 of 763). The same run measured a user `CLAUDE.md` at 88.2% of requests and 46.9% of subagent requests, `.claude/rules` at 76.3% and 46.9%, and one skill per model at 0% ([docs/evidence.md](docs/evidence.md), D19 to D29).
- The raw result is in the repo. `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json` shows 300 sessions, 299 ran to the end, and one `step-timeout`. The README says `npm test` recomputes the figures from that file. I did not run the test suite, so that check is still open.
- It fails safe. Hooks always exit 0 and never block or deny a call. They read local files and make no network calls, except the classifier, which is off by default. `NOONSIGHT_DISABLE=1` turns it off per session, and `noonsight uninstall` removes it.
- The rule effects are mixed and cost money. `verify-changes` on Sonnet 5.5 and Haiku 5.5 got tests run in 29/30 and 27/30 runs, against 0/30 without it. On Sonnet's small fix, though, the cost per run rose from $0.0240 to $0.0505. Sonnet's `carry-through` raised completed backlog runs from 9/40 to 32/40. Haiku's `carry-through` showed no effect.
- Opus 5.5 gets little by default. Its attended-session rules ship off, so an attended Opus session gets nothing from the preset until you enable one.
- It is early. Version 0.1 is not on npm. The install is a git clone plus `npm link`. The benchmark, the stand-in API and the fixtures are all written and run by the same project.

**Conditions and risks:**

Conditions for it to work for you:
- Pin the Claude Code version. The guarantee is measured on 2.1.330 only. The repo's CI pins 2.1.325, and the docs say hook behaviour changes between versions. Re-run the live checks on every upgrade.
- Set `session.unattended_when_env` to your CI or orchestrator variable. Otherwise a headless or unwatched session counts as attended and gets the wrong rules.
- Keep rules that every model needs in `CLAUDE.md`, and use noonsight for per-model rules and subagent rules.
- Do not enable routing in the pilot. Routed subagent calls default to `subagents.permission: "allow"`, so they run without a prompt. In auto mode, a changed call also costs the other calls in its response their review. Decide on that as a team first.
- Repo-level `.noonsight/noonsight.json` is ignored until each person runs `noonsight trust` in that repo. Make that a documented step.
- After a week, run `noonsight report` on a few machines. Check that rules are delivered to the models you expect, and that no rule is listed as never delivered.

Risks:
- The headline number is delivery, not obedience. The stand-in API means no model answered, and the docs say a delivered rule is only context.
- Some subagents get nothing: workflow agents, plugin subagents the tool does not read, and shared starts where calls need different rules. Agent teams in split panes were not checked.
- A compacted conversation resumed with no response and no model named runs on Claude Code's default model, and noonsight cannot tell which. One of 300 sessions hit this in the earlier run.
- Some detection depends on undocumented Claude Code behaviour, including `CLAUDE_CODE_SESSION_ATTENDED` and `ps` parsing on macOS. If that changes, sessions can land in the wrong place without any error.
- The decision log stores session IDs, file paths and rule IDs in `~/.local/state/noonsight/`. Check this against your data policy.
- Each hook run takes about 80 to 150 ms of CPU on a busy laptop, per the same run's `hooktime.json`.

**What it guarantees:** In the measured setup (Claude Code 2.1.330, a stand-in API, 300 random sessions on 2026-11-23), every request with rules due received its own model's rules, and no other model's rules were left in place without a note retiring them; zero violations across the 299 sessions that completed. That rests on the hook logic and on the benchmark harness the same project wrote and runs, and it says nothing about whether a model follows the rules.
