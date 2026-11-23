**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines, pinned to one Claude Code version, and not as a team-wide default yet.

I read the README, the evidence map, the hooks and install docs, and the delivery and rule-effect results. I spot-checked the headline numbers against the committed result files, but I had no shell, so I did not run `npm test` or the benchmark.

## Reasons

- **It closes a gap your setup has.** On Claude Code 2.1.330, a user `CLAUDE.md` holding every model's rules reached 46.9% of subagent requests (60 of 128) and never reaches the built-in Explore and Plan subagents. noonsight reached 100% (763 of 763).
- **It keeps other models' rules out.** Under noonsight 78.6% of the rule text in a request was written for that request's model, against 32.6% for `CLAUDE.md`. It also added fewer characters per request (1,343 against 4,472).
- **The delivery claim checks out against the raw files.** `summary.json` shows 300 sessions generated, 299 run to the end, 0 failed and zero violations of any class. `agree.json` matches the README's figures too.
- **It is low-risk to try.** Hooks always exit 0, never block a call, and use no network unless you turn the classifier on. There are no runtime dependencies. `noonsight uninstall` removes only its own entries, and `NOONSIGHT_DISABLE=1` turns it off per session.
- **No outcome benefit is shown.** The paid pilot on public tasks passed 133, 132 and 133 of 144 runs with no rules, with noonsight and with `CLAUDE.md`. In the rule-effect experiment all 600 runs passed their hidden check with or without rules.
- **The measured rule effects are narrow and cost money.**
  - `verify-changes` made Sonnet and Haiku run tests after a small fix (29 and 27 of 30, against 0), but about doubled that fix's cost on Sonnet ($0.024 to $0.051).
  - `sonnet-5-5/carry-through` raised full completion on one backlog task from 9 to 32 of 40.
  - Fable's rule only shortened report sentences.
  - No Opus rule has any measured effect.
- **Out of the box, your Opus and Fable interactive sessions get nothing.** Their attended rules ship off. The value for you depends on rules you write yourselves, which have no measured effect until you measure them.
- **It is pre-release.** `package.json` says 0.0.1 and private, it is not on npm, and you install it from a clone. The benchmark found nine delivery failures in about five days, all reported as fixed before the current run.

## Conditions and risks

- **Pin Claude Code.** The delivery claim is for 2.1.330 only. The tool relies on several undocumented Claude Code behaviours, and CI's live checks pin 2.1.325. Re-run the delivery corpus (`npm run delivery -- corpus`, no login or tokens) before each upgrade.
- **Write and measure your own rules.** Keep what every model should always have in `CLAUDE.md`, and give noonsight only what differs by model, task or place.
- **Check the subagent gaps against how you work.** These are documented as getting nothing or the wrong model's rules:
  - workflow agents get nothing;
  - agent teams are unmeasured, and split-pane teammates are unchecked;
  - subagents from organization-synced plugins are predicted on their parent's model;
  - parallel foreground calls of one type that need different rules get nothing until the subagent's first Edit, Write or agent call.
- **Check for managed settings.** An organization that sets `allowManagedHooksOnly` or `disableAllHooks` stops the per-account install. The machine-wide install is ignored on logins with server-managed settings.
- **Watch for fallback models.** In the paid pilot, sessions auto-switched to `claude-opus-4-8` and `claude-sonnet-5`, which the preset does not declare, and got only a note. Declare any fallback model you want covered.
- **Expect some overhead.** Each hook costs 80 to 150 ms of processor time (measured on a loaded machine), and an agent call fires several. A subagent start can wait up to two more seconds when several calls of one type are open.
- **Each person has setup to do.** Everyone runs `noonsight install`, and `noonsight trust` once per repository with shared rules. Windows is not supported for the machine-wide install.
- **Do not treat `noonsight report` as proof of receipt.** The log records what the hook returned, not what reached the model; it differed from the observed requests in 135 of 299 sessions on character counts.
- **The benchmark has blind spots.**
  - It is one seed, on scripted sessions against a stand-in API.
  - The reference is noonsight's own resolver, so a wrong rule choice would not show.
  - The self-check caught planted bugs in only 4 of 9 and 7 of 15 exposed sessions for two of its three plants.
  - Sessions never compact on their own, and plan mode is never left by approving a plan.

## What it guarantees

On Claude Code 2.1.330, the rules noonsight's own resolver selects for a model were present in every measured request of that session and its subagents, with no other model's rules left unretired. That rests on one seeded run of 299 scripted sessions against a local API stand-in and on undocumented Claude Code hook behaviour, and it says nothing about whether a model follows the rules or does better work.
