**Verdict: adopt with conditions**

I read the README, `docs/evidence.md`, `docs/hooks.md`, the delivery benchmark's README, the CHANGELOG and `package.json`. I did not run the tests or the benchmark, so every number below is the project's own reported number.

**Reasons**

1. **It addresses a gap you actually have.** You run four models and use subagents a lot. In the project's benchmark, a user `CLAUDE.md` reached every main-conversation request, but only 46.9% (60 of 128) of subagent requests (D28, D34). It also gave each model the other models' rules: 619 requests carried another model's rules with nothing saying they no longer applied (D32). Under noonsight, 763 of 763 subagent requests had their rules, and the count of requests with unretired foreign rules was 0 (D20, D32). Explore and Plan subagents never see `CLAUDE.md` at all, as Claude Code documents.
2. **The delivery evidence is unusually solid.** The test sessions were 300 randomly generated sessions in real, interactive Claude Code; only the Messages API was replaced by a local stub. They covered `/model` switches, `/compact`, `/clear`, resume, three kinds of fork and plan mode. Results: 0 of 299 sessions broke the invariant, and 3,090 of 3,090 requests that were due rules had them (D18, D19). The benchmark found nine of the tool's own bugs (F1–F9), fixed them, and now keeps a reproduction of each. A planted-bug self-check shows the harness catches failures. Each number is traced to a raw file and recomputed by `npm test`.
3. **The rules have not been shown to improve outcomes.** On a paid pilot of public tasks, 133 of 144 runs passed with no rules, 132 of 144 with noonsight and 133 of 144 with a `CLAUDE.md` (B1). Some single rules did change behaviour on small tasks. For example, `verify-changes` took Sonnet 5.5 from 0 of 30 to 29 of 30 runs that tested after their last edit (R3, R14), but it roughly doubled the cost per run ($0.0240 → $0.0505, R6). No Opus 5.5 rule has a measured effect.
4. **Low risk to sessions.** The hooks always exit 0, never deny or change a call (unless you turn on routing), and use no network unless you turn on the classifier. Each hook takes about 80–150 ms of CPU on a busy laptop (D33). `NOONSIGHT_DISABLE=1` and `noonsight uninstall` turn it off. It has no runtime dependencies and is MIT licensed.
5. **But it is very young and tightly coupled to Claude Code.** It is version 0.1.0, and all of its evidence is from 16–23 November 2026. Several things it depends on are undocumented Claude Code behaviour, each observed on 2.1.330 only: `CLAUDE_CODE_SESSION_ATTENDED`, `forkedFrom` in transcripts, the `/fork` job's `state.json`, and the `toolUseId` in subagent metadata. The fixtures already cover five Claude Code versions in about a week.

**Conditions and risks**

Conditions:
- **Pin Claude Code.** Only upgrade after running the corpus (`npm run delivery -- corpus`) against the new version. Every result holds only for the version it was measured on.
- **Use it for delivery, not for quality.** Write your own per-model rules. Keep model-independent rules in `CLAUDE.md`. Measure any rule before relying on it, and check its cost.
- **Plan for the preset's defaults.** Attended Opus 5.5 and Fable 5.2 sessions get nothing from the preset until you `enable` a rule. Sonnet 5.5 and Haiku 5.5 sessions need `NOONSIGHT_SCOPE` to get their scoped rules. Set `session.unattended_when_env` for orchestrated sessions nobody watches.
- **Check your setup against the known blind spots:**
  - Bedrock, Vertex or Foundry: you must pin model aliases with `ANTHROPIC_DEFAULT_*_MODEL`.
  - `default` and `opusplan` models: noonsight can't tell which model they select.
  - A model set only in an MDM profile: it isn't read.
  - Plugins synced by your organisation: their subagents are predicted on the parent's model.
- **Confirm it works for your team.** Every person runs `noonsight trust` once per repository for shared rules. Read `noonsight report` and watch for `MISMATCH` warnings during a trial period.

Risks:
- **Silent gaps:**
  - Workflow agents get no rules.
  - Agent-team teammates in split panes were never tested.
  - Several simultaneous foreground subagent calls of one type that need different rules get nothing until their first Edit, Write or agent call.
  - Edits made through the shell don't fire the `code-edit` trigger.
  - Routing, the classifier and agent teams were never measured.
- **Claude Code update breakage.** A Claude Code update could break delivery without warning. The decision log records what the hook returned, not what reached the model, so `noonsight report` would not catch it.
- **Install side effects.** `noonsight install` edits the settings of every Claude Code login on the account. Under `noonsight run` with rules, `/fork` is unavailable.
- **Maintenance.** It appears to be a single-maintainer project at 0.1.0, already renamed once (it was called sextant), so expect breaking changes.

**What it guarantees**

It guarantees delivery, not obedience: the declared rules for the model a session or subagent actually runs on reach that model's requests, including after a model switch, compaction, clear, resume or fork, apart from its documented gaps. That rests on Claude Code's hooks behaving as they did on 2.1.330, including the undocumented behaviour above, and on a benchmark whose sessions were real but whose model answers came from a stub, measured against noonsight's own resolver.
