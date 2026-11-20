# Rule effect, 2026-11-20: the long design

This run is the design `long` of [the experiment's README](../../README.md#the-long-design), whose pilot, gate and comparisons were fixed before it ran.
It was meant to measure `sonnet-5-5/carry-through` and `haiku-5-5/carry-through` on two long tasks, `migrate` and `backlog`, where a model has room to stop before the end.

Without the rules, Sonnet 5.5 and Haiku 5.5 did every part of both tasks in every pilot run, so no cell passed the gate and the comparisons did not run.
The rules had nothing to change on these tasks: there was no early stop for them to prevent.
So the two carry-through rules are still not measured, and the preset is unchanged.

## What ran

| Item | Value |
| --- | --- |
| Date | 2026-11-20, 18:03 to 18:14 (UTC) |
| Claude Code | 2.1.329 |
| Preset | `claude` 1.3.1 |
| Effort | `low` for both models |
| Place and scope | `unattended`, `build` |
| Runs | The pilot: 20 recorded, none lost; 5 runs of the arm `none` per model and task, at most 2 at a time |
| Cost | $2.52, as Claude Code reports it (list price), against $4.65 projected and a cap of $10; the design, $74.40 projected against a cap of $110, did not run |

`pilot/runs.jsonl` holds every recorded run, and `pilot/summary.md` is what `npm run experiment -- summarize <dir> --design long --pilot` printed from it.
The decision log holds one session start per run, each logged `declared-none` in the place `unattended` and the scope `build`, so no run received a rule.

## The pilot

| Model | Task | Runs | Every part done, as recorded | Every part done, after the check's fix | Turns per run | Cost per run, measured | Cost per run, projected |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sonnet 5.5 | `migrate` (19 parts) | 5 | 5 of 5 | 5 of 5 | 64.2 (49 to 76) | $0.303 | $0.350 |
| Sonnet 5.5 | `backlog` (8 parts) | 5 | 5 of 5 | 5 of 5 | 19.6 (16 to 26) | $0.173 | $0.500 |
| Haiku 5.5 | `migrate` (19 parts) | 5 | 5 of 5 | 5 of 5 | 42.2 (13 to 84) | $0.016 | $0.030 |
| Haiku 5.5 | `backlog` (8 parts) | 5 | 4 of 5 | 5 of 5 | 22.4 (21 to 25) | $0.011 | $0.050 |

A cell enters the design when at least 2 of its 5 pilot runs leave a part undone, and none did, as recorded or after the fix.

One `backlog` run of Haiku 5.5 was recorded with ticket ORCH-15 undone, and that was the hidden check's mistake, not the run's.
The run sorted the blocks by name and wrote "sorted by block name" in the README, in the paragraph under a heading `### blocks <file>`.
The check looked for the word "blocks" and a word on the order in the same paragraph, so it missed a paragraph that says "block" under a heading that says "blocks".
The check now also reads the paragraph under a heading that names the blocks, and a test covers both forms.
Every `backlog` run, laid over the fixture again from the diff it left, passes all eight parts with the fixed check.
`pilot/runs.jsonl` keeps the runs as recorded.

Every run ended on its own, in success, within its budget and its time limit; the longest took 2 minutes.
Every run passed the project's own tests after it, and none changed a file the task does not allow.

## Secondary observations

- No final message handed the work back, by the experiment's wording check.
  Four of Haiku 5.5's five `backlog` reports end with an offer about something nobody asked for, such as "Say if you want the done tickets removed from it", after all eight tickets were done.
  The check does not read "say if" as an offer; these offers leave no requested work undone.
- Ticket ORCH-15 leaves the sort order to whoever does it, and no run stopped to ask: all ten chose an order (every one by block name), and one Haiku report named the choice as one to check.
- On `migrate`, the allow list refused 5.4 calls per run for Sonnet 5.5 and 6.0 for Haiku 5.5: mostly compound shell commands (`cd ... &&`, loops), and the bulk edits some runs first tried with `sed` or `perl`; each run then made the edits with the file tools and went on to the end.
  One Sonnet 5.5 run left its refused script in a temporary directory outside the project.
- Sonnet 5.5 ran the tests after its last edit in 5 of 5 `backlog` runs and 0 of 5 `migrate` runs; Haiku 5.5 in 5 of 5 and 1 of 5.
  The verify rules were off in these runs, as in any run of the arm `none`.

## Cost against the projection

| Model | Task | Runs | Projected per run | Measured per run | Measured |
| --- | --- | --- | --- | --- | --- |
| Sonnet 5.5 | `migrate` | 5 | $0.350 | $0.303 | $1.52 |
| Sonnet 5.5 | `backlog` | 5 | $0.500 | $0.173 | $0.87 |
| Haiku 5.5 | `migrate` | 5 | $0.030 | $0.016 | $0.08 |
| Haiku 5.5 | `backlog` | 5 | $0.050 | $0.011 | $0.06 |
| In total | | 20 | $4.65 | | $2.52 |

The `migrate` runs came within 15 percent of the projection for Sonnet 5.5.
`backlog` cost about a third of what was assumed: its runs took 16 to 26 turns and about 150,000 input tokens, against the 1,400,000 the projection assumed.
Haiku 5.5 cost about half the projection on `migrate` and a fifth on `backlog`.
Nothing of the design's $110 was spent.

## What was not measured

- `sonnet-5-5/carry-through` and `haiku-5-5/carry-through`: without them, the models did every part of these tasks, so the arms could not differ on the signal fixed before the run.
- `opus-5-5/unattended-run`: Opus 5.5 was left out of the design for its cost.
- The arm `carry` on these tasks: the gate kept every cell out before any run with the rule, so what the carry-through rules cost on long tasks is not known either.
- Efforts other than `low`, other places than `unattended`, subagents, and tasks of another size or kind.

## What it means for the next attempt

On these tasks at low effort, an 18-module migration and an 8-ticket backlog took 13 to 84 turns and at most 2 minutes, and both models carried them to the end without the rules.
A task where these models stop early without the rules would have to be of another order: many more parts, a context long enough to reach compaction, or work that spans more than one turn by design.
The pilot and its gate are the part of this design to keep: they settled the question for $2.52, where the design would have spent about $74 on comparisons with nothing to compare.

## Limits

- 5 runs per cell: a cell whose runs stop short one time in ten would most likely show no stop in 5 runs, so the pilot cannot rule out rare early stops.
- One run of the pilot, on one day and one Claude Code version.
- The hidden checks test behavior; one of them read a README too narrowly, as described above.
