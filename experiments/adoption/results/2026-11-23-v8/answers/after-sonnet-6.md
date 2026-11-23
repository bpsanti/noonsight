**Verdict:** Adopt with conditions.

**Reasons:**
- **It fits your setup.** Your team mixes Opus, Sonnet, Haiku and Fable, and many sessions start subagents. noonsight resolves rules by model, so each session and each subagent gets the rules written for the model it runs on. It redelivers them on `/model`, `/clear`, `/compact`, resumes and forks (`docs/hooks.md`).
- **It beats the native options on delivery.** The README compares them on the first 60 of the benchmark's 300 sequences. All counts below are from the 2026-11-23 run on Claude Code 2.1.330.

  | Option | Requests with their rules | Subagent requests with their rules |
  | --- | --- | --- |
  | noonsight | 100% (3,090 of 3,090) | 100% (763 of 763) |
  | User `CLAUDE.md` | 88.2% | 46.9% |
  | `.claude/rules` | 76.3% | 46.9% |
  | Skill per model | 0% | 0% |

  A `CLAUDE.md` is fine for the session's own conversation (100%, 448 of 448). It misses subagents, and it never reaches the built-in Explore and Plan subagents.
- **It keeps other models' rules out.** Under noonsight, 0 requests held another model's rules without a retiring note. A `CLAUDE.md` had 619 such requests and `.claude/rules` had 622.
- **The failure record is honest.** Every number in the README links to an entry in `docs/evidence.md`, and `npm test` recomputes each from the raw result files. It reports nine failures it found and fixed (F1–F9), and a corpus of their reproductions that passes. It also lists its own limits.
- **It is low-risk to run.** The hooks always exit 0 and never block a call. They use no network unless you turn on the optional classifier, and there are no runtime dependencies. Each hook takes roughly 80–150 ms of CPU, measured on a loaded laptop. `NOONSIGHT_DISABLE=1` and `noonsight uninstall` turn it off.
- **The preset rules have measured effects, but narrow ones.** On Sonnet and Haiku, `verify-changes` made the models run tests after a one-file fix in 29 of 30 and 27 of 30 runs, against 0 of 30 without it. On Sonnet, `carry-through` raised complete runs on a 13-ticket backlog from 9 of 40 to 32 of 40.

**Conditions and risks:**
- **Out of the box, you may get little.** Opus 5.5's and Fable 5.2's attended rules all ship off, so attended sessions on those models receive nothing from the preset until you `enable` rules. Sonnet and Haiku attended sessions only get `verify-changes` after a tracked code edit, plus scoped rules if you set a scope. Someone must decide which rules each model gets, or write your own. Delivery is guaranteed, but the rules are only worth what you put in them.
- **Delivery is not obedience.** A delivered rule is context, and the model can ignore it. For rules that must never be broken, use hooks or permission rules.
- **Rules cost money.** `verify-changes` roughly doubled the cost of a small Sonnet fix ($0.0240 to $0.0505). Where the models already did the work, rules changed nothing and still cost tokens. Run `noonsight report` and drop rules that change nothing you can see.
- **Public-task evidence is weak.** A paid pilot found no measurable difference in pass rate (133, 132 and 133 of 144 for off, noonsight and `CLAUDE.md`). Its cost per run was $0.145 off and $0.155 on. The rule-effect samples are small, 30–40 runs per arm on small tasks. Only the preset's rules have effect data; your own rules have none until you measure them.
- **It is tied to the Claude Code version.** Delivery was measured on 2.1.330, rule effects on 2.1.329 and the pilot on 2.1.326. noonsight relies on undocumented behaviour, including fork handling, `CLAUDE_CODE_SESSION_ATTENDED` and metadata files. A Claude Code update can break it silently. Pin versions and rerun the live tests and `noonsight check` after upgrades.
- **Known subagent gaps:**
  - Workflow agents get nothing.
  - Foreground calls of one type that need different rules give their subagents nothing until the subagent's first Edit, Write or agent call.
  - Plugin subagents from plugins noonsight does not read, such as org-synced ones, are predicted on the parent's model and may be wrong.
  - Agent teams in split panes, routing and the classifier were not measured.
- **Smaller limits:**
  - `/fork` does not work in `noonsight run` sessions that have rules.
  - A compacted conversation resumed with no named model falls back to Claude Code's default model, which noonsight cannot tell.
  - Headless runs count as unattended by default. Set `session.unattended_when_env` for interactive sessions nobody watches.
- **It is a young project.** Version 0.1 is not on npm, so you install from a clone. It was renamed from sextant and the evidence is all from this month. The author's benchmark uses a local stand-in for the API, so the 100% shows the right text reached the request, not that any model saw it. Treat the results as the author's own until you reproduce them.
- **Managed settings may block it.** It needs user hooks to be allowed, so check `noonsight check` against your organization's settings.
- **Review preset updates.** Pin the preset with `on_preset_change: "hold"` so updates don't change the team's rules silently.
- **Suggested rollout:**
  1. Pilot on a few machines.
  2. Write a small shared rule set, committed in `.noonsight/noonsight.json` with `noonsight trust` per person.
  3. Review `noonsight report` after a couple of weeks.
- **Skip it if** one model with fixed rules would do. A `CLAUDE.md` is simpler unless you need rules in Explore and Plan subagents.

**What it guarantees:** noonsight guarantees that each request of a session or subagent holds the rules for the model it runs on, with no other model's rules left unretired. This rests on Claude Code's hooks and on one benchmark: 0 failures in 299 randomized real sessions on Claude Code 2.1.330, run against a local stand-in for the API. It does not guarantee that any model follows those rules.
