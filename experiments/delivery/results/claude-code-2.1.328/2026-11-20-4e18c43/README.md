# Delivery benchmark, Claude Code 2.1.328, 2026-11-20, the fuzz level after the fixes of F1 and F2

> **Superseded.** The current runs are [2026-11-24](../../claude-code-2.1.330/2026-11-24-9ee1e55/README.md) and, for what it did not run, [2026-11-23](../../claude-code-2.1.330/2026-11-23-c5b9130/README.md), both on Claude Code 2.1.330; quote its numbers, not the ones here, which are history.

The fuzz level and the native arms of the delivery benchmark ([experiments/delivery](../../../README.md)) on noonsight with the fixes of F1 and F2 (#46), measured against [the run before the fixes](../2026-11-19-467d465/README.md).
The design `after-f1-f2` in [plan.json](../../../plan.json) fixed the comparisons before the run, and the delivery README lists them ("The design `after-f1-f2`").
No request reached Anthropic and no token was spent.

## How it ran

`npm run delivery -- all --concurrency 2` ran at commit `4e18c43`, whose noonsight is the one of `main` at `56a826d`, on Claude Code 2.1.328 and the `claude` preset 1.3.1, on a laptop with 8 cores (macOS, arm64), and took 103 minutes.
Claude Code 2.1.329 was installed by then; the run used the 2.1.328 binary (`--claude`), so that the build of noonsight is the only thing that differs from the run before the fixes.
Everything else is the same as there: the command, seed 1, 300 sessions under `on`, the first 60 under each native arm, and the self-check on those 60.
Only the concurrency differs, 2 sessions at once instead of 6, which changes how long steps take, not the sequences.
`run.json` lists each command with its commit: the two failing sessions were then shrunk, the comparisons evaluated, and the corpus run again at `1b84a31` with the two entries that record them.

The paired comparisons need the sessions of both runs, which are not committed; the run before the fixes left its sessions files on the machine that ran it, and measuring them again gives its committed `summary.json` exactly.

## The comparisons

[comparison.md](comparison.md), from `npm run delivery -- compare --design after-f1-f2`.
It shows 87.4% for the coverage of `claudemd`, its share of four decimals rounded once more; 566 of 648 is 87.3%.
The eight primary comparisons are supported: their measures move the way they expect, with an adjusted p below 0.05.

| | Question | Before or arm | After or `on` | Paired sessions: both, only before or arm, only after or `on` | p (Holm) |
| --- | --- | --- | --- | --- | --- |
| P1 | Sessions under `on` with an unexplained violation | 26 of 296 | 3 of 300 | 3, 23, 0 of 296 | < 0.001 |
| P2 | Coverage under `on` | 99.4% (3,071 of 3,090) | 99.5% (3,199 of 3,216) | 2, 6, 0 of 296 | 0.03 |
| P3 | Coverage, `claudemd` against `on`, first 60 sequences | 87.3% | 100% | 0, 42, 0 of 60 | < 0.001 |
| P4 | Coverage, `rules` against `on` | 70.9% | 100% | 0, 47, 0 | < 0.001 |
| P5 | Coverage, `skills` against `on` | 0% | 100% | 0, 58, 0 | < 0.001 |
| P6 | Subagent coverage, `claudemd` against `on` | 32.2% | 100% | 0, 42, 0 | < 0.001 |
| P7 | Subagent coverage, `rules` against `on` | 32.2% | 100% | 0, 42, 0 | < 0.001 |
| P8 | Subagent coverage, `skills` against `on` | 0% | 100% | 0, 49, 0 | < 0.001 |

P2 is the weakest: coverage moved little because the requests the fixes recovered were few to begin with, and one of the three sessions that still fail lost more requests than before (F4, below).
On the first 60 sequences, `on` covered every request with rules due, 650 of 650, and every subagent request, 121 of 121.

The secondary comparisons:

| | Question | Before | After | Reading |
| --- | --- | --- | --- | --- |
| S1 | Coverage under `on` in the sessions with two quiet steps in a row | 98.9% (of 1,805) | 99.1% | Holds |
| S2 | Requests under `on` with another model's rule and no note | 80 | 22 | Holds |
| S3 | Subagent coverage under `on` is no lower | 99.7% | 99.9% | Holds |
| S4 | The decision log gives the coverage the stub saw | | log 100%, stub 99.4% | Does not hold |

S4: the log and the stub now name a different model only in two sessions, the documented limit (2 requests) and F4 (14 requests), against nine sessions before the fixes ([agree.json](agree.json)).
They still differ on the characters in 60 sessions, every one with two quiet steps in a row, as before: the log records what the hook returned, including a delivery Claude Code then dropped.

Reported without a prediction: the own share went from 78.4% to 78.8%, the right share from 52.5% to 51.4%, and the characters added per request from 1,132 to 1,154 (4.7% of the request text in both runs).
A switch's delivery that may have been lost is now sent again, which adds repeated copies.

### The controls

C1 to C3 expected the native arms to measure the same before and after, since noonsight delivers nothing under them.
`skills` did (0 of 650); `claudemd` went from 87.2% to 87.3% and `rules` from 70.6% to 70.9%, so the two controls do not hold as written.
The rules a session lacks did not change: `claudemd` has 82 requests without their right rules in both runs, and no session went from covered to uncovered or back.
What changed is the requests a session sends: 37 of the 60 `claudemd` sessions differ, 19 of them by one or two requests more or fewer, mostly at a step that starts subagents, and the others in the order of their requests or the step a request is counted under, as the subagents' answers came back at other times.
`claudemd` has 648 main requests instead of 638, all of them covered.
In `rules`, the second subagent start of `s1-0000` sent a subagent request this time and none before, which made that session uncovered after only.
So the sessions repeat at the level of the session, not of the request: a measure counted in requests can move by about one percent between two runs of the same build, which is below every difference the primary comparisons read.

## Under `on`

All 300 sessions ran; the four that stopped on a step whose answer never came before the fixes (`step-timeout`) ran to the end this time.
Coverage after `/clear`, `/compact` and a resume with `--model` is now 100%, from 98.4%, 98.1% and 92.0%; after a resume without `--model` it is 90.5%, from 91.7%, which is the documented limit and F4.
The sessions where every quiet step is followed by a request still never break the invariant (124 of 124).
The tables by path, by number of lifecycle events and by class of violation are in [summary.md](summary.md).

Three sessions break the invariant, and each failed before the fixes too:

| Session | What it is | Requests without their right rules |
| --- | --- | --- |
| `s1-0096` | The documented limit: its first four steps are the corpus entry `limit-default-model-after-compact` | 2, as before |
| `s1-0205` | F3, new | none; Haiku and then Opus read a rule of Sonnet that no note retires |
| `s1-0230` | F4, new | 15, against 3 before the fixes |

The other 23 sessions that failed before the fixes, among them `s1-0170` and `s1-0174`, which shrank to the F1 and F2 corpus entries, break nothing.

## Two failures the fuzzer found

Both are recorded in [failures/](failures) with the sequence they shrank to, and in the corpus as entries that name the violations they show (`expect.failure` `F3` and `F4`), so the corpus goes red the day either changes.
Neither is fixed here.

- **F3, a resume's delivery lost to another resume.**
  `start(sonnet) > turn > resume --model fable > resume --model haiku > turn`, shrunk from `s1-0205` in 21 runs (`f3-two-resumes`).
  The first resume's hook returns Fable's rules and a note that retires Sonnet's; Claude Code adds them to the next request, and the next thing is the end of the process, so no request carries them.
  The second resume then writes a note that retires Fable's rules only, as if the first delivery had arrived, and Haiku reads Sonnet's rules with nothing saying they do not apply.
  It is F1 with a resume in place of `/model`: since the fix, a switch's delivery is unconfirmed, and a resume's delivery is still taken as received.
- **F4, the resumed model after a switch from Sonnet to Haiku.**
  `start(sonnet) > turn > /model haiku > resume > turn`, shrunk from `s1-0230` in 11 runs (`f4-resume-after-switch-from-sonnet`).
  Claude Code runs the resumed conversation on Haiku, the model setting `/model` wrote, while the hook, since the fix of F2, reads the model of the conversation's last response from the transcript, Sonnet, and delivers Sonnet's rules with a note that retires Haiku's.
  The wrong model then stays for the rest of the session, through `/clear`, which is why `s1-0230` lost 15 requests here against 3 before the fixes.
  The same sequence, run once with each other pair, resumed on the model of the last response, as `docs/hooks.md` ("SessionStart") describes: Opus to Haiku, Fable to Haiku, Haiku to Opus, Opus to Sonnet and Sonnet to Opus.
  So Claude Code 2.1.328 does not always resume on the last response's model; what makes it choose the setting here is not established, and the transcripts of the Sonnet to Haiku and Sonnet to Opus sessions have the same entries.

## The native alternatives

The first 60 sessions of the same seed under each arm; every session ran.

| Arm | Coverage | Subagents | Own share | Characters per request | Requests with another model's rule and no note |
| --- | --- | --- | --- | --- | --- |
| `claudemd` | 87.3% (566 of 648) | 32.2% (39 of 121) | 31.6% | 4,414 | 706 |
| `rules` | 70.9% (460 of 649) | 32.2% (39 of 121) | 27.1% | 3,995 | 709 |
| `skills` | 0% (0 of 650) | 0% | no rule text | 0 | 0 |

The reading of [the run before the fixes](../2026-11-19-467d465/README.md) holds: a `CLAUDE.md` or `.claude/rules` file is in every request of the session's own conversation, does not reach the `Explore` and `Plan` subagents, and gives every model the other models' rules; a skill guarantees only its description.

## Self-check

[selfcheck.json](selfcheck.json), on the first 60 sessions; on the real build, none of the 60 broke the invariant.

| Plant | Sessions failing on the planted build and not on the real one | Exposed sessions caught | Shrunk to | On the real build |
| --- | --- | --- | --- | --- |
| `no-switch-note` | 28 of 60 | 27 of 28 | `start(haiku) > /model opus > turn`, in 5 runs | passes |
| `compact-as-resume` | 10 of 60 | 10 of 13 | `start(opus) > turn > /compact > turn`, in 9 runs | passes |

Both plants were caught and shrank to the sequences they shrank to before the fixes.
`s1-0022` and `s1-0020` are the exposed sessions the run before the fixes reads as not truly exposed; `s1-0053` and `s1-0059` under `compact-as-resume` were not read one by one.

## Hook time

[hooktime.json](hooktime.json), 40 runs of each hook with the recorded inputs; when it ended, the load averages over the last 1, 5 and 15 minutes were 7.9, 7.2 and 5.6.
Processor time, median: 80 ms for `session-start` and `subagent-start`, 70 ms for `model-switch`, `agent-call` and `agent-result`, 120 ms for the first edit of a tracked code file and 60 ms for later edits, against 20 ms for a Node.js process that does nothing.
Each is 10 to 20 ms above the run before the fixes, the later edits too, whose code did not change; on a shared laptop that is within what the machine alone moves.

## Corpus

All 18 entries had the outcome they record ([corpus.json](corpus.json), at `1b84a31`): the 15 expected to pass broke nothing, and `limit-default-model-after-compact`, `f3-two-resumes` and `f4-resume-after-switch-from-sonnet` showed every violation they name.
