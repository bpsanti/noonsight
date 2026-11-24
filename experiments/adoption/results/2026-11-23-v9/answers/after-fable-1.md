**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines, not a team-wide rollout.

I read the README, the hooks contract, the evidence map, the Claude Code verification list, the delivery benchmark and the paid pilot results. I did not read the source in `src/` or run the tests, so everything below rests on the project's own documentation and committed results.

## Reasons

- **It fits your setup.** It delivers rules per model to sessions and subagents, and re-delivers on `/model`, `/compact`, `/clear`, resume and fork. Its own guidance is to skip it when every session runs one model.
- **Subagents are where it beats `CLAUDE.md`.** In its benchmark a user `CLAUDE.md` reached 60 of 128 subagent requests and never reaches Explore or Plan subagents. noonsight reports 763 of 763.
- **It keeps other models' rules out.** A shared `CLAUDE.md` gave each model mostly other models' rules (about 33% of the rule text was its own). noonsight's figure was 79%, with the remainder retired by a note after a model switch.
- **No quality gain is shown.** The paid pilot resolved 133 of 144 tasks without rules, 132 with noonsight and 133 with a `CLAUDE.md`. That pilot delivered to the main conversation only, so it does not test the subagent case.
- **Measured rule effects are narrow.** On small tasks, `verify-changes` made Sonnet and Haiku run the tests after editing (29 of 30 against 0 of 30 on Sonnet). No Opus rule has a measured effect, and the only Fable effect is shorter sentences in reports.
- **Out of the box, your Opus and Fable interactive sessions get nothing.** Their attended rules ship off. Sonnet and Haiku get `verify-changes` only after a tracked code edit. The value for you is mostly in rules you write yourselves.
- **It is one week old.** It is version 0.1.0 from a single author, and all evidence is dated 2026-11-16 to 2026-11-23. Its own fuzzer found nine delivery failures in that week; all are reported fixed.
- **It is low-risk to try.** It has no runtime dependencies, the hooks never block a call, it reads only local files by default, and `noonsight uninstall` removes it.

## Conditions and risks

- **Write model-specific rules first.** If you cannot name rules that should differ by model, a `CLAUDE.md` is simpler.
- **Pin Claude Code or re-check on upgrade.** The delivery result holds for 2.1.330 only, and several behaviours it depends on are undocumented by Claude Code. Rerun `npm run delivery -- corpus` (no login or tokens needed) after each Claude Code update.
- **Known gaps for subagents.**
  - Workflow agents get nothing.
  - Parallel calls of one subagent type that need different rules get nothing until their first Edit, Write or agent call.
  - Subagents from organisation-synced plugins are predicted on the parent's model.
  - Agent teams, routing and the classifier are unmeasured.
- **Fallback models are undeclared.** In the pilot Claude Code switched by itself to Opus 4.8 and Sonnet 5, which the preset has no rules for. Those sessions get only a note that the earlier rules no longer apply.
- **Cost goes up.** The pilot cost 7% more per run than no rules, against 19% more for a shared `CLAUDE.md`. `verify-changes` roughly doubled the cost of a small fix.
- **Hook overhead.** Each hook run takes 80 to 150 ms of processor time, and a subagent start can wait up to two seconds more.
- **Team rollout is per person.** Each person installs it and runs `noonsight trust` in each repository with shared rules. The machine-wide install was not checked live.
- **Platform caveats.** On macOS it reads the command line through `ps`, which can misread `--model`. On Bedrock, Vertex or Foundry, aliases need the pinning variables set.
- **The benchmark is self-graded.** The API was a local stand-in, so no model answered, and the reference for "right rules" is noonsight's own resolver. A wrong resolution would not show.
- **My spot-check was partial.** The `CLAUDE.md` figures in the raw `summary.json` match the README. I did not confirm noonsight's own figures in that file.

## What it guarantees

It guarantees delivery, not obedience: the rules declared for a model are placed in the requests of each session and subagent running on it, which rests on Claude Code's hooks behaving as they did on version 2.1.330 and on the author's own stubbed-API benchmark.
