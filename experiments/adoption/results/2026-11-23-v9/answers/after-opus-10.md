**Verdict: adopt with conditions.** Run it as a small, time-boxed pilot first, not a team-wide rollout.

I read the README, `docs/evidence.md`, `docs/hooks.md` and the delivery experiment's failures and limits. I didn't run the test suite or the tool, so the numbers below are the project's own, as committed.

**Reasons**

- **It fits how you work.** It's built for teams that use several models and start subagents. A `CLAUDE.md` reached every main-conversation request in the benchmark but only 46.9% of subagent requests (D28, D34), and never the built-in Explore and Plan subagents. It also gives every model the other models' rules: only about 33% of the rule text in a request was for that request's model (D30), and 619 requests held another model's rules with nothing marking them as no longer applying (D32). noonsight's measured result was 100% coverage (3,090 of 3,090 requests, 763 of 763 subagent requests) and 0 requests with stray rules (D19, D20, D32).
- **The evidence is careful about what it claims.** Each number points to a raw file, and `npm test` recomputes it (`test/evidence.test.ts`). The README says plainly that the tool delivers rules and doesn't make the model follow them, and it lists its own failures (F1–F9).
- **It hasn't been shown to improve results.** In the paid pilot, 133, 132 and 133 of 144 runs passed with no rules, with noonsight and with a `CLAUDE.md` (B1). The measured effects are behaviours such as "ran the tests after editing" on small tasks (R3, R10, R14–R16). No Opus 5.5 rule has a measured effect, and Fable 5.2's only measured effect is shorter sentences (R9).
- **Out of the box it does nothing for watched Opus and Fable sessions.** Their rules for watched sessions ship off, so those sessions get nothing until you turn rules on. Sonnet and Haiku get most of their rules only if you set a task scope.
- **It's very new and depends on one Claude Code version.** Every result is from Nov 16–23, 2026, and the current delivery run is from today, on Claude Code 2.1.330. A week of testing turned up nine delivery bugs. Fork handling relies on Claude Code details that Claude Code doesn't document (`forkedFrom`, `state.json`, `CLAUDE_CODE_SESSION_ATTENDED`, the subagent `toolUseId` metadata), and any Claude Code update could change them.
- **The cost looks small.** The tool measured about 1,343 extra characters per request (against about 4,472 for a `CLAUDE.md` holding every model's rules) and 80–150 ms per hook (D31, D33). The hooks never block anything, it has no runtime dependencies, and the only feature that uses the network (the classifier) is off by default.

**Conditions and risks**

Conditions:
- **You have rules that really differ by model or task.** If not, the README itself says a `CLAUDE.md` is simpler.
- **Your Claude Code version matches what was tested.** Pin or track it near 2.1.330, and re-check delivery after each upgrade with `noonsight report` and the live tests.
- **Someone owns the configuration.** That person writes or turns on the rules (`enable`), sets `session.unattended_when_env` for unwatched sessions, has people start sessions with `NOONSIGHT_SCOPE`, and keeps `on_preset_change` on `warn` or `hold`.
- **Install from npm** (`npm install -g`), not `npx`. With `npx`, delivery stops silently once npm's cache is cleared.
- **Use Anthropic's API directly, or set the variables that pin aliases.** On Bedrock, Vertex or Foundry, aliases like `sonnet` can't be resolved without `ANTHROPIC_DEFAULT_*_MODEL`. `default`, `opusplan` and a model set only in an MDM profile can't be resolved at all.
- **Measure the effect yourself.** Compare a few weeks of pilot work with and without your rules. Delivery logs prove rules arrived, not that they helped.

What could go wrong:
- These get nothing: workflow agents, subagents from org-synced plugins (they're predicted on the parent's model), and parallel foreground calls of one subagent type that need different rules, until each subagent's first Edit, Write or agent call. Split-pane agent teams and routing weren't tested.
- A Claude Code update changes hook behaviour, and rules quietly stop arriving or the wrong model's rules arrive.
- `noonsight install` changes the hooks in every Claude Code login on the machine. That's code from a one-maintainer project, recently renamed from sextant, running on every session and subagent event. Review it as you would any dependency.
- Sessions started with `noonsight run` and rules can't `/fork`.
- The benchmark checks results against noonsight's own rule resolver and a stand-in API. A wrong rule selection wouldn't show up there, and no real model reacted to the rules.

**What it guarantees**

It guarantees that the rules you declare for a model are added to the requests of each session and subagent running on that model, including after a model switch, compaction, clear, resume or fork, with the exceptions listed above. It doesn't guarantee the model follows them. That rests on Claude Code's hooks behaving as recorded on 2.1.330, some of it undocumented, and on a stand-in-API benchmark checked against the tool's own resolver.
