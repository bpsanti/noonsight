**Verdict: adopt with conditions.** It solves a real delivery problem for a mixed-model, subagent-heavy team like yours. But only the delivery is proven. Whether the rules help is mostly unmeasured, and every result is tied to one Claude Code version from the past week.

**Reasons**

1. **It fits how you work.** You run four models and use many subagents, which is where the built-in options do worst. On the same sessions, a user `CLAUDE.md` with every model's rules reached only 46.9% of subagent requests (60 of 128). It never reaches the built-in Explore and Plan subagents. It also puts the other models' rules into every request: only 32.6% of the rule text a request got was written for its own model, against 78.6% under noonsight.
2. **The delivery claim checks out.** I opened the raw result file for the current run (`experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, key `on-g2-s1-n300`). It says what the README says: 299 of 300 sessions finished, and all 3,090 requests that should have had rules did, including all 763 subagent requests. Every number in the README links to a raw file, and the docs say `npm test` recomputes them. I didn't run the tests myself. Earlier runs found nine of the tool's own failures (F1–F9), and the docs report all of them openly.
3. **What the rules change is thin, and the authors say so.** A measured effect exists for only three rules, all on small tasks:
   - `verify-changes` (Sonnet, Haiku): runs that tested after their last edit went from 0 of 30 to 29 of 30 (Sonnet) and 27 of 30 (Haiku).
   - `carry-through` (Sonnet): 32 of 40 finished a 13-ticket backlog, against 9 of 40 without it.
   - `low-context-report` (Fable): shorter sentences in its final report.

   No Opus rule has any measured effect. In a paid pilot, runs with and without rules passed equally often (133 vs 132 of 144), so better work is not shown. Cost goes up: `verify-changes` roughly doubled the cost per run on the small fix ($0.0240 → $0.0505 for Sonnet).
4. **It's low risk to run.**
   - The hooks never block a call and always exit 0.
   - They read only local files. The one thing that uses the network is an optional classifier, which is off by default.
   - It has no runtime dependencies and an MIT license.
   - It logs every delivery, and `noonsight uninstall` removes the hooks.

**Conditions and risks**

- **Pin the noonsight version and the Claude Code version, and re-check after every Claude Code upgrade.** The delivery result holds for Claude Code 2.1.330 only, and the docs list many undocumented behaviours they depend on. An upgrade could quietly break delivery. Run `noonsight report` and look for the warning noonsight shows when a subagent starts on a different model than predicted.
- **Know what it doesn't reach:**
  - workflow agents
  - agent-team teammates in split panes (not tested)
  - subagents from plugins your organization syncs, which noonsight can't read
  - some subagents started together in one response, until their first Edit, Write or agent call
  - sessions where `/fork` is needed, if they were started with `noonsight run` and rules
  - sessions on the account's `default` or `opusplan` model, which it says it can't identify

  If your team relies on any of these, coverage there is partial or none.
- **The default setup does little for Opus and Fable.** An attended Opus or Fable session gets nothing from the preset until you turn rules on. Sonnet and Haiku need a scope (`NOONSIGHT_SCOPE`) for most of their rules. Headless runs only count as unattended if you set `session.unattended_when_env` correctly.
- **Treat rules as context, not enforcement.** Write your own rules and measure them, or keep only the ones with a measured effect. A rule with no effect still costs tokens.
- **Provider and platform details:**
  - On Bedrock, Vertex or Foundry you must set the `ANTHROPIC_DEFAULT_*_MODEL` variables, or it can't resolve model aliases.
  - On macOS, reading `--model` from the command line can be ambiguous.
  - Each hook takes about 80–150 ms of CPU.
- **Maturity is the biggest risk.**
  - All the measurements date from 16–23 Nov 2026.
  - The project was recently renamed (from sextant).
  - It appears to have a single maintainer.
  - Its hooks run on every session.

  Review its code and its updates as you would any dependency that runs on every developer machine. Start with a pilot group before installing it for the whole team.
- **Rules for a repository need each person to run `noonsight trust`** in that repository. Until they do, the repository's rules do nothing for them.

**What it guarantees:** It guarantees only that each session and subagent receives the rules declared for the model it actually runs on, as context rather than obeyed instructions. That rests on Claude Code's hook behaviour as observed on version 2.1.330, on its prediction of each subagent's model matching what Claude Code really uses, and on a benchmark against a stand-in API that judged correctness with noonsight's own resolver. So a rule picked wrongly would not show up there, only a rule delivered wrongly.
