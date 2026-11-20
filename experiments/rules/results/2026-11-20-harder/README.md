# Rule effect, 2026-11-20: the harder design

This run is the design `harder` of [the experiment's README](../../README.md#the-harder-design), whose tasks, pilot, gate and comparisons were fixed and pushed before any request reached a model.
It measures `sonnet-5-5/carry-through` and `haiku-5-5/carry-through` on two long tasks built to give a model reasons to stop before the end, after the design `long` found none on its tasks ([2026-11-20-long](../2026-11-20-long/README.md)).

`sonnet-5-5/carry-through` supports its source on the backlog `triage`: with the rule, 32 of 40 Sonnet 5.5 runs did every part, against 9 of 40 without it (Holm p < 0.001).
Almost all of the difference is one ticket that leaves a decision open: without the rule, 30 of 40 runs built the option, kept the old numbers, and handed the decision back in their report; with it, 6 of 40 did.
`haiku-5-5/carry-through` is not shown on `triage` (6 of 40 against 2 of 40, p 0.26): Haiku 5.5's runs missed one part in both arms, a part found only by reading a TODO, which is not a stop the rule names.
On the migration `codes`, neither model left a part undone without the rule, so those cells did not enter the design.
The preset is unchanged.

## What ran

| Item | Value |
| --- | --- |
| Date | 2026-11-20: the pilot from 19:01 to 19:15 (UTC), the design from 19:17 to 21:20 |
| Claude Code | 2.1.329 |
| Preset | `claude` 1.3.1 |
| Effort | `low` for both models |
| Place and scope | `unattended`, `build` |
| Runs | The pilot: 20, 5 of the arm `none` per model and task. The design: 160, 40 per arm on `triage` for each model. None lost, at most 2 at a time |
| Cost | $2.57 for the pilot and $24.61 for the design, $27.18 in all, as Claude Code reports it (list price), against caps of $10 and $110 |

`pilot/runs.jsonl` and `runs.jsonl` hold every recorded run; `pilot/summary.md` and `summary.md` are what `npm run experiment -- summarize <dir> --design harder [--pilot]` printed from them.
The decision log holds one session start per run: the 80 runs of the arm `carry` received the model's `carry-through` and no other rule, and the 100 runs of the arm `none` were logged `declared-none`, all in the place `unattended` and the scope `build`.

## The pilot

| Model | Task | Runs | Left a part undone | Parts undone | Turns per run | Cost per run, measured | Cost per run, projected |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sonnet 5.5 | `codes` (39 parts) | 5 | 0 of 5 | none | 21.2 (15 to 29) | $0.183 | $0.600 |
| Sonnet 5.5 | `triage` (12 parts) | 5 | 4 of 5 | PAN-24 (4), PAN-27 (1) | 22.0 (17 to 26) | $0.292 | $0.350 |
| Haiku 5.5 | `codes` (39 parts) | 5 | 0 of 5 | none | 30.6 (15 to 80) | $0.020 | $0.035 |
| Haiku 5.5 | `triage` (12 parts) | 5 | 5 of 5 as recorded, 4 of 5 after the check's fix | PAN-27 (4), PAN-29 (1, the check's mistake) | 26.2 (24 to 30) | $0.019 | $0.025 |

A cell enters the design when at least 2 of its 5 pilot runs leave a part undone, so `triage` entered for both models and `codes` for neither.
At the cost the pilot measured, the two cells projected $24.82 against the design's cap of $110.

On `codes`, all ten runs did all 39 parts in 15 to 80 turns, and none of them edited the 36 validators one by one.
The table of codes in `ERRORS.md` lists each field's checks in the order its validator makes them, so a run could read the table, match the n-th `return false` of a file to the n-th row of its field, and write every file from a script.
Sonnet 5.5 did that in every run, with a Node script it wrote and ran (`node` is allowed); the long tail of edits the task was built on never happened.

One `triage` run of Haiku 5.5 was recorded with PAN-29 undone, and that was the hidden check's mistake, not the run's.
The run gave dry goods a warning window of 60 days, which PAN-24 allows, and the check of `expiring --json` used a dry batch due in 60 days as one that no window lists.
The check now uses a batch due tomorrow and one that expired yesterday, which every window treats alike, and a test covers long windows; the fix went in before the design ran, and the gate's reading is the same with it.
Every pilot run, laid over the fixture again from the diff it left, gives the same parts with the fixed check except that one, which does every part.
`pilot/runs.jsonl` keeps the runs as recorded.

## The comparisons

| Rule | Task | With the rule | Without | p | Holm p | Reading |
| --- | --- | --- | --- | --- | --- | --- |
| `sonnet-5-5/carry-through` | `triage` | 32 of 40 (65-90%) | 9 of 40 (12-38%) | < 0.001 | < 0.001 | supports the source |
| `haiku-5-5/carry-through` | `triage` | 6 of 40 (7-29%) | 2 of 40 (1-17%) | 0.26 | 0.26 | not shown |
| `sonnet-5-5/carry-through` | `codes` | | | | | not run: the pilot found no part undone |
| `haiku-5-5/carry-through` | `codes` | | | | | not run: the pilot found no part undone |

The signal is the share of runs that did every part of the task, as the hidden check reads it; Holm's adjustment runs over the two comparisons that ran.

## Where the runs stopped short

Every run ended on its own, in success, within its budget and its time limit, and no final message handed the work back by the experiment's wording check.
The runs that left a part undone did not stop early in the sense of ending the session before the work: they worked through every ticket and left one decision or one piece of work for someone else, and said so in the report.

| Model | Arm | PAN-24 undone | PAN-27 undone | Closing undone | Every part done |
| --- | --- | --- | --- | --- | --- |
| Sonnet 5.5 | `carry` | 6 of 40 | 3 of 40 | 0 of 40 | 32 of 40 |
| Sonnet 5.5 | `none` | 30 of 40 | 1 of 40 | 5 of 40 | 9 of 40 |
| Haiku 5.5 | `carry` | 0 of 40 | 34 of 40 | 1 of 40 | 6 of 40 |
| Haiku 5.5 | `none` | 1 of 40 | 38 of 40 | 6 of 40 | 2 of 40 |

- PAN-24 asks for a warning window per category, says Ana and Joe disagree on the numbers, and that nobody has settled them.
  Without the rule, 30 of 40 Sonnet 5.5 runs added a way to set a window per category (most often `--window produce=3,canned=21`) and left every category at 7 days, writing that "nobody has settled the numbers, so every category stays at 7 days" or that "Ana and Joe still need to agree".
  With the rule, 34 of 40 picked numbers themselves; the 6 that did not wrote the same as the runs without it.
  This is the stop the rule's text names as no reason to stop: a question the model could settle itself (Fisher's p < 0.001, secondary).
- PAN-27 asks to bring every quantity to its base unit with `src/units.js`; a TODO in that file says the donation sheets also use the spellings in `data/unit-aliases.txt`, which nothing reads.
  Haiku 5.5 converted `kg` and `g` but did not read the aliases in 38 of 40 runs without the rule and 34 of 40 with it (p 0.26, secondary), and its reports describe the ticket as done.
  Nothing in those runs is a stop or a hand-back: the work was not seen, which is not what either rule claims to change.
- The closing part asks that every ticket done move to Done, and the parked one stay open.
  Its misses come from the same decision: 5 Sonnet 5.5 runs without the rule left PAN-24 in Open as not settled, and 6 Haiku 5.5 runs without the rule, against 1 with it, set the windows but kept PAN-24 open "until Ana and Joe agree" (p 0.11, secondary).
- The plan PAN-26 asks for before any code was written and the code done in every run of both models, so the plan was not a place where these runs stopped.

## Cost and other measures

| Model | Arm | Cost per run | Output tokens per run | Turns per run | Tests after the last edit |
| --- | --- | --- | --- | --- | --- |
| Sonnet 5.5 | `carry` | $0.285 | 15,526 | 22.6 | 17 of 40 |
| Sonnet 5.5 | `none` | $0.292 | 16,046 | 22.9 | 18 of 40 |
| Haiku 5.5 | `carry` | $0.020 | 20,504 | 23.8 | 4 of 40 |
| Haiku 5.5 | `none` | $0.018 | 18,343 | 23.9 | 4 of 40 |

- `sonnet-5-5/carry-through` did not make Sonnet 5.5's runs longer or costlier here: the decisions it made the runs take cost no more than the options and explanations the runs without it wrote instead (output tokens p 0.26).
  Its source says sessions "run longer and cost more"; on this task they did not.
- `haiku-5-5/carry-through` added about 2,200 output tokens per run (p < 0.001), about $0.002 or 11 percent at list price.
- One Haiku 5.5 run with the rule changed `data/stock.txt`, a file the task does not ask to change; no other run of the design changed one.
- The verify rules were off in every run, so the share of runs that ran the tests after their last edit is what each model does on its own on this task.

The design cost $24.61 against $30.00 projected for the same runs: Sonnet 5.5 $0.288 a run against $0.350, Haiku 5.5 $0.019 against $0.025.

## What it means

- `sonnet-5-5/carry-through` is measured: on a backlog whose tickets leave a decision open, at low effort and unattended, it made Sonnet 5.5 settle the decision itself instead of handing it back, which took the share of runs that did every part from 23 to 80 percent, at no measurable cost.
  That is the effect its source claims, on one kind of stop: none of these runs ended before the end of the work, with or without the rule.
- `haiku-5-5/carry-through` is still not shown: without the rule, Haiku 5.5 picked the numbers of PAN-24 itself in 39 of 40 runs, and kept the ticket open for others to confirm in 6, so there was little for the rule to change, and the part it missed most is one the rule does not address.
- A migration where every edit follows from a table in the same order as the code is not a long tail for these models: they script it.

## What was not measured

- Both rules on `codes`, which the pilot kept out.
- `opus-5-5/unattended-run`: Opus 5.5 was left out of the design for its cost.
- Which of the reasons to stop built into `triage` each rule acts on, apart from what the parts left undone show: the task holds several at once.
- Efforts other than `low`, other places than `unattended`, subagents, and tasks of another size or kind.

## Limits

- One run of the design, on one day and one Claude Code version, on one backlog: whether the rule settles other kinds of open decisions, or decisions with more at stake, is not measured.
- PAN-24's part passes with any window shorter than 7 days for produce and longer than 7 for canned goods; a run that settled the question the other way, as Joe would have it, counts as undone.
  No run did: the runs that settled it all followed Ana.
- The hidden checks test behavior; one of them failed a correct choice in the pilot, as described above, and was fixed before the design.
