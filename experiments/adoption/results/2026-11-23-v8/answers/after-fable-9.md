**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines, pinned to one commit, and only if you have rules that really differ by model or must reach subagents.

I read the README, docs, changelog, result summaries and CI config, and searched the source for network and process use. I did not run the tests or recompute any number from the raw files.

## Reasons

- **It targets your situation.** Its own "when not to use" list is single-model teams with fixed rules; a team on four models with many subagents is the case it is built for.
- **The gap it closes is in subagents.** In its benchmark a single `CLAUDE.md` reached 100% of the main conversation's requests (448 of 448) but 46.9% of subagent requests (60 of 128), and never the built-in Explore and Plan subagents. noonsight reports 763 of 763.
- **It fails open.** Hooks always exit 0, never deny a call, and have a 10-second timeout. The worst case is a missing or wrong rule, not a blocked session.
- **Its footprint is small.** There are no runtime dependencies, and I found no network imports in `src/`. It starts other processes only where the docs say: `ps`, `git`, `claude --version`, the optional classifier and the watcher service.
- **The evidence is unusually candid.** Every number links to a raw file, limits are listed, and nine delivery bugs are documented with reproductions.
- **It is very young.** `package.json` says 0.0.1 and private, it is not on npm, the whole changelog is "Unreleased", and there is one author. All results date from 2026-11-16 to 2026-11-23.
- **Delivery has not been shown to improve outcomes.** In the paid pilot, 133, 132 and 133 of 144 runs passed without rules, with noonsight and with a `CLAUDE.md`; noonsight cost about 7% more per run than no rules.
- **The preset does little out of the box.** Attended Opus and Fable sessions receive nothing by default, and no Opus rule has a measured effect. `verify-changes` for Sonnet and Haiku roughly doubles the cost of a small fix ($0.024 to $0.0505).

## Conditions and risks

Conditions for it to work for you:

- **You write the rules.** The value comes from your own per-model rules, since the delivery claim covers any rule but the measured effects cover only a few preset ones.
- **You pin and re-check.** Pin a noonsight commit and a Claude Code version, and run `noonsight check` plus the delivery corpus before each Claude Code upgrade.
- **Every machine qualifies.** It needs Node 20 or newer, an install per developer from a clone, and macOS or Linux; Windows is not supported.
- **Your organisation allows user hooks.** Managed settings with `allowManagedHooksOnly` or `disableAllHooks` stop it.
- **Repository rules are reviewed like code.** After a one-time `noonsight trust`, later changes to a repo's rule files apply without asking, so a merged PR can put text into everyone's sessions.

What could go wrong:

- **Claude Code changes underneath it.** It relies on undocumented behaviour: an undocumented environment variable, transcript and job-file formats, and `ps` parsing on macOS. Claude Code went from 2.1.325 to 2.1.330 during the project's one week, and CI's live checks are pinned to 2.1.325 while the headline claim is on 2.1.330.
- **Some subagents get nothing.** These gaps are documented:
  - Workflow agents receive no rules.
  - Parallel same-type calls needing different rules get nothing until their first Edit, Write or agent call.
  - Subagents from organisation-synced plugins are assumed to run on the parent's model.
  - Agent teams in split panes are unchecked.
- **Fallback and new models get no rules.** Keys are exact model IDs, and the pilot saw Claude Code switch by itself to Opus 4.8 and Sonnet 5, which the preset does not cover.
- **The log is not proof of receipt.** It records what the hook returned, not what reached the model. In the current run it matched on coverage but differed on rule-text share in 135 of 299 sessions.
- **The benchmark is the author's own.** It uses a stubbed API, one seed, the preset's rules, and noonsight's own resolver as the reference, so a wrong resolution would not show.

## What it guarantees

It guarantees nothing contractually and says nothing about whether models obey. What it offers is a measured claim that on Claude Code 2.1.330 each request carried the rule text for its own model (0 of 299 sessions broke this, 3,090 of 3,090 requests), resting on the author's own stubbed-API benchmark and on hook behaviour that is partly undocumented.
