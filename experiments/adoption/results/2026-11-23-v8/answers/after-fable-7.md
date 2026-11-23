**Verdict: adopt with conditions**, as a time-boxed pilot on a few machines, not a team-wide rollout yet.

I read the docs, the evidence map, the result files and parts of the source. I could not run the test suite or the tool in this session (no shell), so nothing below is from my own run; I did confirm the headline delivery numbers against the raw `summary.json`.

## Reasons

- **It fits your setup.** noonsight delivers per-model rules to each Claude Code session and subagent through hooks. Mixed models plus subagents is where the native options fall short in its benchmark: a user `CLAUDE.md` reached 46.9% of subagent requests (60 of 128) and never reaches the built-in Explore and Plan subagents.
- **The delivery evidence is good, but narrow.** In the current run (2026-11-23, Claude Code 2.1.330), 0 of 299 sessions broke the invariant, and 3,090 of 3,090 requests held their rules. Those sessions ran against a local stand-in API, so no model answered.
- **Better outcomes are not shown.** The paid pilot resolved 133, 132 and 133 of 144 tasks with no rules, with noonsight and with a `CLAUDE.md`. noonsight cost about 7% more per run than no rules.
- **Only some preset rules have a measured effect.** `verify-changes` made Sonnet and Haiku run tests after a small fix (29 and 27 of 30 runs, against 0 without it), at about double the cost of that fix. `carry-through` helped Sonnet (32 of 40 against 9 of 40) but not Haiku. No Opus rule has a measured effect.
- **Out of the box, your interactive Opus and Fable sessions get nothing.** Their attended-session preset rules ship off; only headless runs and subagents receive rules by default.
- **It is very young.** It is version 0.0.1, not on npm, and installed from a clone with `npm link`. Its benchmark found nine delivery failures (F1 to F9), all fixed within the last few days, the latest today.
- **It is low-risk to try.** The hooks never block, always exit 0, and use no network unless you turn on the optional classifier. There are no runtime dependencies, and `noonsight uninstall` removes the hooks.

## Conditions and risks

- **You need rules that differ by model.** If you have none, a `CLAUDE.md` is simpler; the tool's own README says so.
- **Pin Claude Code, and re-check on upgrade.** The claim is measured on 2.1.330 only, and its CI pins 2.1.325. It relies on undocumented behaviour (an undocumented environment variable, transcript and metadata file layout, reading the `claude` command line via `ps`). Run its delivery corpus on each new version.
- **Declare your exact model IDs.** Rules match exact identifiers, and the preset covers only Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5. Any other model gets a warning and no rules, including an automatic fallback: in the pilot, Claude Code switched to Opus 4.8 or Sonnet 5 by itself on one task.
- **Failures are silent.** Because it never blocks, a broken hook means missing rules, not an error. The decision log records what the hook returned, not what reached the model.
- **Subagent gaps remain.** Workflow agents get nothing. Parallel foreground subagents of one type that need different rules get nothing until their first edit or agent call. Subagents from organization-synced plugins may get the parent model's rules. Agent teams, routing and the classifier are unmeasured.
- **The benchmark can miss things.** Its self-check caught planted bugs in only 4 of 9 and 7 of 15 exposed sessions for two of three plants. The oracle is noonsight's own resolver, so a wrong resolution would not show.
- **Rollout takes effort per person.** Each person installs it and runs `noonsight trust` per repository. The hook points at the clone by absolute path, so moving or upgrading it means reinstalling. Windows is unsupported, and an organization setting of `allowManagedHooksOnly` or `disableAllHooks` stops it.
- **Review `verify-changes` before leaving it on.** It ships on for Sonnet and Haiku and adds cost.

## What it guarantees

noonsight guarantees that each session and subagent request carries the rules configured for the model it actually runs on, and no other model's rules left unretired — not that the model obeys them. That rests on one stub-API benchmark of 299 generated sessions on Claude Code 2.1.330, within the limits listed above.
