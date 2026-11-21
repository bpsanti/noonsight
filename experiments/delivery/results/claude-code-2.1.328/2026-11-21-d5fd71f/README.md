# Delivery benchmark, Claude Code 2.1.328, 2026-11-21, after the fixes of F3 and F4

The whole delivery benchmark ([experiments/delivery](../../../README.md)) on noonsight with the fixes of F3 and F4 (#53), measured against [the run that found them](../2026-11-20-4e18c43/README.md).
The design `after-f3-f4` in [plan.json](../../../plan.json) fixed the comparisons before the run, and the delivery README lists them ("The design `after-f3-f4`").
No request reached Anthropic and no token was spent.

## How it ran

`npm run delivery -- all --concurrency 2` ran at commit `d5fd71f`, whose noonsight is the one of `main` at `f061f03`, on Claude Code 2.1.328 and the `claude` preset 1.3.1, on a laptop with 8 cores (macOS, arm64), and took 101 minutes.
Claude Code 2.1.330 was installed by then; the run used the 2.1.328 binary (`--claude`), so that the build of noonsight is the only thing that differs from the run before the fixes.
Everything else is the same as there: the command, seed 1, 300 sessions under `on`, the first 60 under each native arm, the self-check on those 60, and 2 sessions at once.
`run.json` lists each command with its commit; no session failed in a way that needed shrinking, so the comparisons were evaluated right after.

## The result

Under `on`, one session of 300 breaks the invariant, `s1-0096`, and it is the documented limit: its first four steps are the corpus entry `limit-default-model-after-compact`, and it lost the same 2 requests as in both earlier runs.
Coverage under `on` is 99.9% (3,219 of 3,221 requests with rules due), and subagent coverage is 100% (668 of 668).
The two sessions that showed F3 and F4, `s1-0205` and `s1-0230`, break nothing.
No new failure appeared.

## The comparisons

[comparison.md](comparison.md), from `npm run delivery -- compare --design after-f3-f4`.
At most three sessions could change, too few for a paired test to reach 0.05, so the design has no primary comparison and each is read from its measure alone.

| | Question | Before | After | Paired sessions: both, only before, only after | Reading |
| --- | --- | --- | --- | --- | --- |
| K1 | Sessions under `on` with an unexplained violation, only `s1-0096` expected | 3 of 300 | 1 of 300 | 1, 2, 0 of 300 | Holds |
| K2 | Coverage under `on` | 99.5% (3,199 of 3,216) | 99.9% (3,219 of 3,221) | 1, 1, 0 | Holds |
| K3 | Requests under `on` with another model's rule and no note | 22 | 2 | | Holds |
| K4 | Subagent coverage under `on` is no lower | 99.9% | 100% | 0, 1, 0 | Holds |
| C1 | `claudemd` is unchanged | 87.4% | 87.3% | 42, 0, 0 of 60 | Does not hold as written |
| C2 | `rules` is unchanged | 70.9% | 70.6% | 47, 0, 0 | Does not hold as written |
| C3 | `skills` is unchanged | 0% | 0% | 58, 0, 0 | Holds |
| S4 | The decision log gives the coverage the stub saw | | log 100%, stub 99.9% | | Does not hold |

K1 is the prediction behind the design: `s1-0205` (F3) and `s1-0230` (F4) stop failing, and `s1-0096` keeps failing.
The 2 requests of K3 are those of `s1-0096`.

C1 and C2 move by a request or two, as between the two earlier runs: no session went from covered to uncovered or back (the paired counts), and `claudemd` has 82 requests without their right rules in both runs.
What moves is how many requests a session sends at a step that starts subagents, as the subagents' answers come back at other times.

S4: the log and the stub now name a different model in one session only, the documented limit (2 requests), against two sessions before the fixes ([agree.json](agree.json)).
They still differ on the characters in 60 sessions, every one with two quiet steps in a row, as before: the log records what the hook returned, including a delivery Claude Code then dropped.

Reported without a prediction: the own share went from 78.8% to 79.0%, the right share from 51.4% to 51.6%, and the characters added per request from 1,154 to 1,155 (4.7% of the request text in both runs).

## Under `on`

All 300 sessions ran.
Coverage is 100% on every path but a resume without `--model`, 90.5% (19 of 21), where the 2 requests left are the documented limit.
The sessions where every quiet step is followed by a request still never break the invariant (124 of 124), and those with two quiet steps in a row now have 99.9% coverage, from 99.1%, with one session failing, from three.
The tables by path, by number of lifecycle events and by class of violation are in [summary.md](summary.md).

## The native alternatives

The first 60 sessions of the same seed under each arm; every session ran.

| Arm | Coverage | Subagents | Own share | Characters per request | Requests with another model's rule and no note |
| --- | --- | --- | --- | --- | --- |
| `claudemd` | 87.3% (565 of 647) | 32.2% (39 of 121) | 31.5% | 4,415 | 707 |
| `rules` | 70.6% (459 of 650) | 32.2% (39 of 121) | 27.0% | 3,987 | 709 |
| `skills` | 0% (0 of 654) | 0% | no rule text | 0 | 0 |

On the same 60 sequences, `on` covered every request with rules due and every subagent request, as in the run before.
The reading of [the run before the fixes of F1 and F2](../2026-11-19-467d465/README.md) still holds.

## Self-check

[selfcheck.json](selfcheck.json), on the first 60 sessions; on the real build, none of the 60 broke the invariant.

| Plant | Sessions failing on the planted build and not on the real one | Exposed sessions caught | Shrunk to | On the real build |
| --- | --- | --- | --- | --- |
| `no-switch-note` | 28 of 60 | 27 of 28 | `start(haiku) > /model opus > turn`, in 5 runs | passes |
| `compact-as-resume` | 9 of 60 | 9 of 13 | `start(opus) > turn > /compact > turn`, in 9 runs | passes |

Both plants were caught and shrank to the sequences they shrank to in both earlier runs.
`compact-as-resume` missed `s1-0058` as well as the three exposed sessions it missed before (`s1-0020`, `s1-0053`, `s1-0059`); it was not read one by one.

## Hook time

[hooktime.json](hooktime.json), 40 runs of each hook with the recorded inputs; when it ended, the load averages over the last 1, 5 and 15 minutes were 3.9, 3.1 and 3.0.
Processor time, median: 60 ms for every hook but the edits, 90 ms for the first edit of a tracked code file and 50 ms for later edits, against 20 ms for a Node.js process that does nothing.
Each is 10 to 30 ms below the run before, with a lower load on the machine; the fixes added no measurable time.

## Corpus

All 18 entries had the outcome they record ([corpus.json](corpus.json)): the 17 expected to pass broke nothing, `f3-two-resumes` and `f4-resume-after-switch-from-sonnet` among them, and `limit-default-model-after-compact` showed every violation it names.
