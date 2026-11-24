**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines first, not a team-wide rollout.

**Reasons**

- **It fits how you work.** You use four models and lots of subagents. A `CLAUDE.md` misses subagents and gives every model the other models' rules. In the tool's own benchmark, a `CLAUDE.md` reached all of the main conversation's requests (448 of 448) but only 46.9% of subagent requests (60 of 128). Requests carrying another model's rules with nothing retiring them: 619 with `CLAUDE.md`, 0 with noonsight.
- **Its delivery numbers are strong and checkable.** On Claude Code 2.1.330, 0 of 299 sessions broke the rule. 3,090 of 3,090 requests that were due rules held them, including 763 of 763 subagent requests. Every number links to a raw file in `experiments/`. I spot-checked one against `summary.json` and it matched. I did not run the test suite.
- **Its docs state its own limits openly.** The README says what it doesn't cover and lists the nine bugs (F1–F9) its benchmark found. That makes it easier to trust.
- **There's little evidence the rules improve results.** The paid pilot found no quality difference: 133, 132 and 133 passing runs out of 144 for no rules, noonsight and `CLAUDE.md`. The measured effects come from small tasks, mostly on Sonnet and Haiku, for example "ran the tests after the last edit". No Opus rule has a measured effect. Those effects also cost money: on some tasks the cost per run roughly doubled ($0.024 to $0.0505). You'd be adopting a reliable way to deliver rules, not a proven gain in output.
- **It depends on Claude Code details Anthropic doesn't document.** Several mechanisms rely on behaviour recorded on Claude Code 2.1.326–2.1.330 that isn't in Claude Code's docs. Examples: the forked session's `state.json`, the `CLAUDE_CODE_SESSION_ATTENDED` variable, the subagent metadata's `toolUseId`, and the transcript format. The dates in its history (Nov 14–23, 2026) suggest the project is about a week old, and it found nine delivery bugs in that week.

**Conditions and risks**

Conditions:
- **Pin both versions.** Pin the noonsight version, and re-run its corpus check (`experiments/delivery`) before moving the team to a new Claude Code version. The guarantee holds only for the Claude Code version it was measured on.
- **Install it globally.** Use `npm install -g` or the plugin, not `npx`. The `npx` copy stops delivering once npm's cache is cleared.
- **Keep routing and the classifier off.** Neither is measured.
  - With routing on, calls it changes are allowed without a permission prompt by default (`permission: allow`). In auto mode it also causes the other agent calls in the same response to be refused.
  - The classifier sends up to 4,000 characters of each task through your login.
- **Set unattended sessions explicitly.** Set `session.unattended_when_env` for orchestrated sessions. Otherwise interactive Opus and Fable sessions get nothing from the preset, because their attended rules ship off.
- **Write your own rules.** Don't expect value from the preset alone. Write the team's model-specific rules, and use `noonsight report` to drop rules that change nothing you can see.
- **Expect one setup step per repo.** Each person must run `noonsight trust` in each repo that has rules, or that repo's rules don't apply.

Risks:
- **Some cases get no rules or wrong rules:**
  - A workflow's agents get nothing.
  - Several parallel subagent calls of one type that need different rules get nothing until that subagent's first Edit, Write or agent call.
  - Subagents from org-synced plugins are predicted on their parent's model.
  - Teammates in split panes, `opusplan`, and Bedrock or Vertex aliases without pinning variables are unmeasured or produce warnings.
  - `/fork` is unavailable in sessions started with `noonsight run`.
- **A Claude Code update can break delivery without a word.** The tool can report a model mismatch, but it can't detect its own missed delivery.
- **The benchmark grades itself.** It uses a stub API and the tool's own resolver as the answer key, so a wrong resolution would go unnoticed.
- **There's overhead.** Each hook run costs about 80–150 ms of CPU, on every agent call and on edits until the first tracked code file is edited.
- **It's a supply-chain exposure.** Globally installed hooks run in every session, so updates need review. It does have no runtime dependencies.

**What it guarantees**

It guarantees that each session and subagent's requests contain the rules declared for the model it runs on, again after a model switch, compaction, clear, resume or fork, outside the listed gaps; it does not guarantee the model follows them. That rests on Claude Code's hooks behaving as recorded on 2.1.330, including several undocumented fields, and was measured with a stand-in API against the tool's own resolver.
