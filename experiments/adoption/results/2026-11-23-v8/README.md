# Adoption evaluation, 2026-11-23, v8

The design pre-registered in [the v8 section](../../README.md#v8-one-current-value-per-fact) of the evaluation's README: `after` is `e8a3c60`, `before` is `f061f03`.
Ten `after` sessions per model were planned; nine per model are scored, by the pre-registered money rule (below).
Sessions ran at `medium` effort, at most two at once; the judge is Claude Opus 5.5 at `medium` effort.
Its first calibration agreed on 8 of 9 answers ([calibration-first.json](calibration-first.json)) and, after the declared correction of one calibration sentence, its second on 9 of 9 ([calibration.json](calibration.json)).

## Result

**The README does not pass the pre-registered bar.**
23 of 36 `after` answers were grounded, 64% (Wilson interval 48-78%), against 0 of 12 `before`, 0% (0-24%); Fisher's exact test, two-sided, p < 0.001 ([summary.md](summary.md)).
The overall condition (80%, 29 of 36) is not met.
The per-model condition (60%, 6 of 9) is not met: Sonnet 5.5 and Haiku 5.5 have 4 of 9 each.
The third condition, at least as often as `before`, is met.

| Model | v5 | v6 | v7 | v8 | v8 interval | Bar |
| --- | --- | --- | --- | --- | --- | --- |
| Fable 5.2 | 5 of 5 | 2 of 5 | 8 of 10 | 7 of 9 | 45-94% | 60% |
| Opus 5.5 | 5 of 5 | 2 of 5 | 6 of 10 | 8 of 9 | 57-98% | 60% |
| Sonnet 5.5 | 5 of 5 | 5 of 5 | 7 of 10 | 4 of 9 | 19-73% | 60% |
| Haiku 5.5 | 3 of 5 | 1 of 5 | 5 of 10 | 4 of 9 | 19-73% | 60% |
| All | 18 of 20 (90%) | 10 of 20 (50%) | 26 of 40 (65%) | 23 of 36 (64%) | 48-78% | 80% |

Every one of the 36 answers recommended adopting with conditions, named a real limit and invented no feature; 33 stated the delivery claim correctly, and 23 gave no false reason or claim.
The 13 not grounded all adopt on wrong grounds (36%).

Fisher's exact test of v8 against v7: p 1.0; against v6, p 0.40; against v5, p 0.057.
The evidence map differs between these runs, and v8's reference differs from v7's in the delivery claim's measurement and L5, so the comparisons are read as a direction.
v8 shows no gain over v7 from giving each fact one current value.

## Read this result with these in mind

**Two versions of Claude Code.**
33 of the 36 scored `after` sessions ran on 2.1.330.
`after-opus-9`, `after-sonnet-9` and `after-haiku-9` (and the dropped `after-fable-10`) ran on 2.1.331, because the host's `claude` was updated during the run; `DISABLE_AUTOUPDATER` applies inside the sandbox only.
Without those three: 21 of 33 grounded; the bar is not met either way.
Which version the judge ran on is not recorded in the judgments.

**The `before` count fell from 1 of 12 in v7 to 0 of 12**, and its correct claims from 9 to 4, on the same answers, with the changed reference.
They were judged with the same reference as the `after` answers.

**The samples are small.** The per-model intervals all include 60%.

## Where the answers went wrong

All judgments stand as made; the notes read them against the repository at `e8a3c60`.
In 11 of the 13 the answer is inaccurate as written, in one the judgment rests on the reference missing a limit, and in one it turns on the judge's reading of a close paraphrase.

| Answer | What failed | Which was wrong |
| --- | --- | --- |
| `after-fable-5` | Credits 30/30 and +58% cost, the preset's rules arm, to `verify-changes` | The answer; the README gives 29 of 30 for it alone |
| `after-sonnet-5` | Credits R14 to `verify-changes` | The answer, as above |
| `after-haiku-3` | Gives $0.141 to $0.151 as B2, and says every current measurement is 2.1.329 or 2.1.330 | The answer: those means are the pilot's over both rounds, a real figure of its README, not B2's; R9 and R13 ran on 2.1.328 and the pilot on 2.1.326 |
| `after-sonnet-9` | Says the rule-effect results are on 2.1.329 | The answer: R9, which it cites, ran on 2.1.328; the README says so |
| `after-haiku-5` | Reads 88.2% and 76.3% as main-session coverage; leakage of other models' rules | The answer (D25, D26 count all requests; D34 and D32) |
| `after-fable-6` | 299 "generated" sessions, evidence from 14 November, last five failures found in the newest run | The answer on the first: 300 were generated and 299 ran to the end. On the others, the earliest run with a result here is 2026-11-16, and F5 to F9 were found by generator 2 on builds before the current run's |
| `after-haiku-6` | "299 simulated sessions" | The answer: the sessions are real, only the API is a stand-in |
| `after-haiku-7` | Only `verify-changes` and `carry-through` have an effect | The answer: the README also names `low-context-report` (R9) |
| `after-sonnet-7` | The value is not in the preset | The answer overstates: R10, R14, R15 show effects |
| `after-haiku-8` | Hooks never use the network | The answer omits the classifier, which the README gives as the one exception; [docs/hooks.md](../../../../docs/hooks.md) says the hooks never use the network themselves |
| `after-sonnet-3` | Guarantees every request carries exactly its rules | The answer, stated without the known limits |
| `after-sonnet-8` | Guarantees every request with rules due holds them | The judge's reading: close to the README's own statement of the benchmark result, given in the answer as resting on it |
| `after-opus-2` | `/fork` breaks in sessions started through `noonsight run` | The reference: the README and [docs/launcher.md](../../../../docs/launcher.md) say `/fork` is refused in a session `noonsight run` started with rules; the answer omits "with rules" |

Counting `after-sonnet-8`, `after-opus-2` and `after-haiku-8` as grounded, a reading made after the results and not the pre-registered one, gives 26 of 36 (72%), with Sonnet 5 of 9 and Haiku 5 of 9; it still does not pass.

## Files read

[files-read.md](files-read.md) lists them per session.
No session opened `test/adoption.test.ts` or `test/evidence.test.ts`, and no stream holds the evaluation's scoring vocabulary or its results' path.
Every session listed the repository with Glob, which shows `test/adoption.test.ts`'s name.
35 of the 36 read `README.md`, and 33 read `docs/evidence.md`: 21 of those 33 are grounded, and 2 of the other 3.
Seven read `CHANGELOG.md`, all grounded (16 of the other 29); 12 read `package.json`, 8 grounded.

## What the copy held

The archive of `e8a3c60`, without this folder, has no Markdown file containing the word "adoption", and no result of a run of this evaluation; the pre-registration lists the other matches and why they are not.

## Departures and the money rule

- **Nine per model instead of ten.** The runner stopped at 33 answers.
  Those and the 12 `before` answers were judged, and then the rest ran one at a time through the money gate, which read no score.
  `after-fable-10` passed at $44.78; `after-opus-10` would have been $45.16 against $45, so round ten did not fit whole and is dropped.
  `after-fable-10` (grounded) is in `runs-dropped.jsonl` and `judgments-dropped.jsonl`; with it, 24 of 37 and Fable 8 of 10, and the bar is still not met.
  The gate counts whole per-session budgets, which are above what Opus spent on average; the rule was not changed.
- The first calibration failed and one calibration sentence was corrected, as the README's revision paragraph declares.
- The cap rose from $40 to $45 before any paid session, also declared.
- The Claude Code update, above.
- One judgment cost $0.292, above the $0.27 reserve; the cap was not reached.

## Cost

| Item | Cost |
| --- | --- |
| Two calibrations | $3.19 |
| 37 `after` sessions | $27.40 |
| 49 judgments | $11.81 |
| **v8 total** | **$42.40, against a cap of $45** |

The `Cost` line of [summary.md](summary.md) counts the 12 reused `before` sessions, which v3 paid for, and leaves out the dropped session and judgment.
