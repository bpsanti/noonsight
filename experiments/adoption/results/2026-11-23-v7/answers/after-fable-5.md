**Verdict: adopt with conditions.** Run it as a pilot with a few people, pinned to a commit, and only if you have rules that differ by model.

I read the README, the hooks, install and evidence docs, the benchmark write-ups and the changelog. I spot-checked one result file against the README and grepped the source for network and process calls. I did not run the test suite or audit the source in full.

**Reasons**

- **It fits your setup.** Mixed models plus subagents is the case it was built for. In its benchmark, a shared `CLAUDE.md` reached every main-conversation request but only 32% of subagent requests (39 of 121), and never the built-in Explore and Plan subagents. It also gave every model the other models' rules.
- **The delivery evidence is careful but self-measured.** The latest run had 0 of 299 sessions break the delivery rule, with 3,090 of 3,090 requests covered. Those sessions talked to a local stand-in for the API, and "correct" was defined by the tool's own resolver, so a wrong resolution would not show.
- **It is very young.** The version is 0.0.1, marked private, not on npm, and installed from a clone. Its testing found nine delivery bugs in about a week, and the last five were fixed in a run dated today, still under "Unreleased".
- **It leans on Claude Code internals.** Several facts it relies on are undocumented (a headless-session environment variable, transcript fields, subagent metadata files). Results are for Claude Code 2.1.328 and 2.1.330 only.
- **Benefit to outcomes is unproven.** In its 588-run paid pilot, task success was the same with and without the rules (132 vs 133 of 144), at about 7% more cost. The measured rule effects are on small tasks with 30–40 runs per arm; one rule roughly doubled the cost of a small Sonnet fix ($0.024 to $0.051).
- **Out of the box it does little for interactive Opus and Fable sessions.** The preset's rules for attended sessions on those two models ship off. You would have to enable them or write your own.
- **The footprint is modest and reversible.** It adds hook entries to each person's Claude Code `settings.json` and runs a Node process per hook (50–90 ms median CPU, 80–150 ms on a loaded machine). The hooks never block a call, and `noonsight uninstall` removes them. The only process calls I found in the source are `git`, `ps`, `claude` and the service manager; the only network use is the optional classifier, which is off by default.

**Conditions and risks**

Conditions:
- You have, or will write, rules that really differ by model; otherwise its own README says a `CLAUDE.md` is simpler.
- Pin a Claude Code version, or rerun its corpus (`npm run delivery -- corpus`, a few minutes, no login) before each upgrade.
- Keep rules every model needs in `CLAUDE.md`, and leave routing and the classifier off, since neither is measured.
- Everyone runs macOS or Linux, and your organization's managed settings do not disable user hooks.
- For per-repository rules, each person runs `noonsight trust` once per clone; until then the file does nothing.

Risks:
- **Silent gaps.** A Claude Code update can change hook behaviour, and delivery can stop for some paths without an error. The decision log records what the hook returned, not what reached the model.
- **Known holes.** Workflow agents get nothing. Agent teams are unmeasured. Subagents from organization-synced plugins may get the parent model's rules. One compact-then-resume case can pick the wrong model.
- **Undeclared models.** The preset covers Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5. Sessions on other versions get a warning and no rules, including when Claude Code falls back to an older model by itself.
- **Maintenance.** It appears to be a single-author project with no release yet, so you would own upgrades and breakage yourselves.

**What it guarantees**

It guarantees delivery only — that each session and subagent request carries the rules configured for the model it runs on, not that the model follows them — and that rests on the author's own fuzz benchmark against a stand-in API on two Claude Code versions, not on any contract with Claude Code.
