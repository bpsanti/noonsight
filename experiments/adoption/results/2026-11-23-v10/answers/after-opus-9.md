**Verdict: adopt with conditions.** Adopt it only if your team actually has rules that should differ by model, and start with a pilot, not a team-wide rollout.

**Reasons**

1. **It fixes a real gap, and your usage hits it.** Rules in `CLAUDE.md` don't reach Claude Code's built-in Explore and Plan subagents, and `CLAUDE.md` hands every model the rules written for the other models too. The repo's own benchmark found a user `CLAUDE.md` reached only 46.9% (60 of 128) of subagent requests, against 100% (763 of 763) under noonsight (`README.md:39-47`). Your team runs four models and many subagents, which is exactly that case.
2. **The tool is careful and low-risk.** Every hook exits 0, never blocks or denies a call, and has a 10-second timeout. It reads only local files; the network is used only by an optional classifier, which is off by default. A config with any error is refused as a whole and nothing is delivered, rather than half-applied. It has no runtime dependencies and keeps a decision log you can audit with `noonsight report` (`docs/hooks.md:8-25`, `package.json`).
3. **It's honest about its limits.** The README separates "delivered" from "obeyed" and lists what it can't do. The repo's tests also recompute every number in the README from the raw result files.
4. **It hasn't been shown to make the work better.** In a paid pilot, 133 of 144 tasks passed without rules, 132 under noonsight and 133 with a `CLAUDE.md` (`README.md:231`). Measured effects are narrow. For example, `verify-changes` made Sonnet and Haiku run the tests after editing, at roughly twice the cost per run. No rule for Opus has any measured effect. On Opus and Fable, attended sessions get nothing from the preset until you turn rules on.
5. **It's very new and depends on Claude Code internals.** It's version 0.1.0 from a single author, and the current benchmark run is dated today. Several things it relies on are undocumented by Claude Code: `CLAUDE_CODE_SESSION_ATTENDED`, `forkedFrom` in transcripts, the background job's `state.json`, and subagent metadata `toolUseId`. They were checked only on Claude Code 2.1.325–2.1.330 (`docs/hooks.md:123,168,330`).

**Conditions and risks**

- **Conditions:**
  - You have, or will write, rules that really differ by model, place or kind of task. If every session should get the same rules, the README itself says to use `CLAUDE.md` instead (`README.md:263`).
  - Pin both the noonsight version and the Claude Code version. Re-run `noonsight check` and the live tests whenever Claude Code updates.
  - Install with `npm install -g`, not `npx`: with `npx` the hooks run a cached copy, and delivery stops silently once that cache is cleared.
  - Set `session.unattended_when_env` for any orchestrated interactive sessions, so they're treated as unattended.
  - Everyone who clones a repo with rules runs `noonsight trust` in it once. Each Claude Code login needs its own install.
- **Risks:**
  - A Claude Code update could break model detection, fork handling or subagent matching, and rules would then go missing or reach the wrong model. The hooks warn on some of these failures, but not all of them.
  - Known gaps: workflow agents get nothing; subagents from organization-synced plugins are predicted on their parent's model; and when several calls of one type need different rules, their subagents get nothing until their first Edit, Write or agent call.
  - The benchmark's stand-in API never compacts on its own and leaves out agent teams, routing and the classifier. Its reference for "correct" is noonsight's own resolver, so a wrong choice of rules wouldn't show up, only a wrong delivery.
  - Added cost: rules that work tend to raise spending per run.

**What it guarantees:** It guarantees delivery, not obedience. The rules you declare for a model get put into the requests of each session and subagent running on that model, and again after a model switch, compaction, `/clear`, resume or fork. That rests on Claude Code's hook behavior as recorded on versions 2.1.325–2.1.330, much of it undocumented. The evidence is 299 interactive sessions on 2.1.330 against a stand-in API, with noonsight's own resolver as the reference.

I read the docs, the hook config, the launcher script and the benchmark write-up, but didn't run `npm test` or the benchmarks. Those figures are the repo's own claims; I haven't reproduced them.
