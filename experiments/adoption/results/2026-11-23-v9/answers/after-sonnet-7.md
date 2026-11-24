**Verdict:** Adopt with conditions.

**Reasons:**
- **It fits your setup.** You run several models, mostly Opus, Sonnet and Haiku with a few on Fable, and many sessions start subagents. That is the case noonsight is built for: it gives each session and each subagent the rules written for the model it actually runs on. It also re-delivers them when the model changes, or after compact, clear, resume or fork.
- **Delivery is measured, and it beats the native options.**
  - The benchmark ran real interactive Claude Code sessions (2.1.330) against a stand-in API. It generated 300 random sessions, and 299 ran to the end. In those, 3,090 of 3,090 requests with rules due had them (100%), and 763 of 763 subagent requests did (D19, D20).
  - On the first 60 sequences, a user `CLAUDE.md` covered 88.2% of requests and `.claude/rules` covered 76.3%. Both covered only 46.9% of subagent requests. A skill per model covered 0%.
  - Noonsight put no other model's rules unretired into any request. `CLAUDE.md` and `.claude/rules` did so in about 620 requests each (D32).
- **Some rules have a measured effect, on small tasks.**
  - `verify-changes` raised the share of runs that ran the tests after their last edit. For Sonnet on a one-file fix it went from 0 of 30 to 29 of 30, and for Haiku from 0 of 30 to 27 of 30.
  - `carry-through` raised Sonnet's completion on a 13-ticket backlog from 9 of 40 to 32 of 40.
  - `low-context-report` shortened Fable's report sentences.
- **It is safe to try.**
  - The hooks never block anything.
  - It has no runtime dependencies and reads local files only.
  - The classifier is the one thing that uses the network, and it is off by default.
  - `noonsight uninstall` and `NOONSIGHT_DISABLE=1` undo it.
  - The README says plainly what it does not do and lists its own failures (F1 to F9).
  - A test recomputes every README number from the raw result files.

**Conditions and risks:**
- **Don't expect better output quality.** Every run passed the hidden check with or without rules (600 of 600). The paid pilot on public tasks showed no measurable difference: 133 of 144 runs passed without rules, 132 with noonsight, 133 with a `CLAUDE.md`. What it changes is process, such as running tests or finishing a backlog. It also costs more per run. `verify-changes` roughly doubled the cost on small tasks, for example $0.0240 to $0.0505 for Sonnet. Measure on your own tasks before keeping each rule.
- **Opus and Fable get little out of the box.** Their attended rules ship off, so an interactive Opus or Fable session receives nothing until you `enable` a rule. Only `unattended-run` (Opus) and `low-context-report` (Fable) are on, and those apply only to headless runs and subagents.
  - Only Fable's `low-context-report` has a measured effect. No Opus rule has been measured at all.
  - Sonnet and Haiku need a scope (`NOONSIGHT_SCOPE`) for most of their rules.
- **Set `session.unattended_when_env`.** Interactive sessions that nobody watches count as attended unless you set it to your orchestrator's or CI's variable.
- **Known delivery gaps matter for you because you use subagents heavily.**
  - A workflow's agents get nothing.
  - Foreground calls of one type that need different rules give their subagents nothing until the first Edit, Write or agent call.
  - Subagents from a plugin noonsight does not read, such as one an organization syncs, are predicted on their parent's model.
  - Agent teams in split panes were not checked.
  - A conversation compacted with no response since and then resumed with nothing that names a model runs on Claude Code's default model, which noonsight cannot detect.
  - Routing, agent teams and the classifier are not measured.
- **Evidence is pinned to specific Claude Code versions.**
  - Delivery was tested on 2.1.330, rule effects on 2.1.329 (Fable's on 2.1.328), and the paid pilot on 2.1.326.
  - It depends on hook behavior that Claude Code can change. Pin or track versions, run `noonsight check` and `noonsight report` after upgrades, and watch for rules that are on but never delivered.
- **Check your policy and your installs.**
  - It won't work if managed settings forbid user hooks.
  - `npx` installs break when npm's cache is cleared. Use `npm install -g noonsight`.
  - Each repository's `.noonsight/noonsight.json` does nothing until each person runs `noonsight trust` in that repository.
  - In sessions started by `noonsight run` with rules, `/fork` is unavailable.
- **The evidence is the author's own.** It is a young project, formerly called sextant, and every result comes from the author's tests. I read the docs and result summaries but did not run the tests or rerun any experiment.
- **Do you need it at all?** If most of your rules are the same for every model, keep them in `CLAUDE.md`. The one gap is that Explore and Plan subagents never receive `CLAUDE.md`.
- **A reasonable pilot:** install it on a few Sonnet and Haiku sessions and a few subagent-heavy ones. Keep the rules that change something you can see, and check `noonsight report`.

**What it guarantees:** Through Claude Code's hooks, it puts the rules declared for a model into the requests of each session and subagent running on that model, which is delivery and not obedience. That rests on the hook mechanism plus a decision log, and it was verified against a local API stand-in in the 300-session benchmark on Claude Code 2.1.330. It excludes the gaps listed above.
