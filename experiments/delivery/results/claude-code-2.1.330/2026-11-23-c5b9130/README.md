# Delivery benchmark, Claude Code 2.1.330, 2026-11-23, generator 2

The whole delivery benchmark ([experiments/delivery](../../../README.md)) with the second generator, which draws the paths the earlier runs left out: sessions started through `noonsight run` and in a project with a trusted noonsight configuration, forks (`--fork-session`, `/branch`, `/fork`), `/resume` typed in the session, plan mode, and subagents that edit a file.
No request reached Anthropic and no token was spent.

## How it ran

`npm run delivery -- all --concurrency 2` ran at commit `c5b9130`, on Claude Code 2.1.330 and the `claude` preset 1.3.1, on a laptop with 8 cores (macOS, arm64), and took 146 minutes.
That build has the fixes of F5 to F9, the failures the new paths exposed ([the delivery README](../../../README.md#failures-found-and-a-limit)).
Seed 1, generator 2: 300 sessions under `on`, the first 60 under each native arm, and the self-check on those 60, with three plants.
The machine ran other work at the same time, with a load average near 45 when checked during the run, which lengthened steps and is why the hook times below are not comparable with earlier runs.

Generator 2 draws other sequences than generator 1 from the same seed, so this run is not compared with the runs on Claude Code 2.1.328; it has no design in [plan.json](../../../plan.json), and every number below is read from its own measures.

## The result

Under `on`, 299 of 300 sessions ran, and none breaks the invariant: coverage is 100% (3,090 of 3,090 requests with rules due), subagent coverage 100% (763 of 763), and no request holds another model's rule without a note that retires it.
The documented exception for subagents whose calls differ no longer occurs, since noonsight gives those subagents rules since #61.
The session that did not run, `s1-0123`, is one where a `/model` switch drew no switch and the turn after it got no answer; the driver records it as not driven.

Every path is covered on every request with rules due ([summary.md](summary.md)), the new ones included:

| Path | Requests with rules due |
| --- | --- |
| A `/fork` session's own requests | 37 |
| After `/fork`, in the session itself | 12 |
| After `/branch` | 23 |
| After a forking resume, with and without `--model` | 14 |
| After `/resume` typed in the session | 12 |
| In plan mode, and after leaving it | 60 and 72 |
| After starting subagents that edit a file | 223 |

By how the session started: 186 sessions through `claude` (1,782 requests with rules due), 54 through `claude` in the project (674), 46 through `noonsight run` (520) and 13 through `noonsight run` in the project (114), all covered.
Under `noonsight run`, Claude Code refused `/fork` 6 times, in sessions whose system prompt held the launcher's rules; the step is recorded as `fork-refused` and the session went on.
Of the 15 `/model` steps that drew no switch, 14 switched between Sonnet and Haiku in plan mode, where Claude Code already runs Sonnet for Haiku.

## The corpus

All 33 entries had the outcome they record ([corpus.json](corpus.json)): the reproductions of F1 to F9 pass, every entry for a new path passes, and `limit-default-model-after-compact` shows the violations it names.

[before-fix/](before-fix) holds the eight entries of F5 to F9 run with this harness against the build of `main` before their fixes (`19adf38`), through `--noonsight`: every one breaks the invariant there, with `foreign-unretired` in the session's own requests, `missing-own` too for F7 and F8, and `own-retired` for F9.

## The native alternatives

The first 60 sessions of the same seed under each arm; every session ran.
Under them, a session drawn to start through `noonsight run` or in the project starts through `claude` in a project without noonsight's configuration, and is measured against the reference without the project.

| Arm | Coverage | Subagents | Own share | Characters per request | Requests with another model's rule and no note |
| --- | --- | --- | --- | --- | --- |
| `claudemd` | 88.2% (508 of 576) | 46.9% (60 of 128) | 32.6% | 4,472 | 619 |
| `rules` | 76.3% (441 of 578) | 46.9% (60 of 128) | 27.9% | 3,889 | 622 |
| `skills` | 0% (0 of 579) | 0% (0 of 128) | no rule text | 0 | 0 |

These are generator 2's sequences, so they do not compare with the native arms' numbers on Claude Code 2.1.328.

## Self-check

[selfcheck.json](selfcheck.json), on the first 60 sessions; on the real build, none of the 60 broke the invariant.

| Plant | Sessions failing on the planted build and not on the real one | Exposed sessions caught | Shrunk to | On the real build |
| --- | --- | --- | --- | --- |
| `no-switch-note` | 32 of 60 | 32 of 32 | `start(haiku) > turn > resume --model sonnet > /model haiku > turn`, in 9 runs | passes |
| `compact-as-resume` | 4 of 60 | 4 of 9 | `start(opus) > turn > /compact > turn`, in 11 runs | passes |
| `fork-unknown` | 7 of 60 | 7 of 15 | `start(haiku) > turn > resume --fork-session --model opus > turn`, in 19 runs | passes |

`fork-unknown` takes away what a fork's start knows of the conversation it copied, so F5 and F6 come back; the fuzzer catches it on its own and shrinks it to the shape of F5.
The 8 exposed sessions it did not catch were not read one by one.

## The decision log

[agree.json](agree.json): on the 299 sessions under `on` that ran, the log and the stub give the same coverage, 100%, on all 2,804 requests of the sessions' own conversations, and name the same model on each.
They differ on the characters in 135 sessions, as in earlier runs: the log records what the hook returned, including a delivery Claude Code then dropped or never sent.

## Hook time

[hooktime.json](hooktime.json), 40 runs of each hook with the recorded inputs, on the loaded machine.
Processor time, median: 80 to 150 ms per hook, against 20 ms for a Node.js process that does nothing; these are higher than on Claude Code 2.1.328 with a lighter load, and say nothing about the cost of the fixes.

## Before this run

A run of generator 2 at the build before the fixes of F8 and F9, stopped after its `on` level, found them: `s1-0138` (F8) and `s1-0182` (F9) broke the invariant, and `s1-0279` showed a stub that read an earlier prompt quoted by `/branch`, fixed in the same change.
Runs before it found F7 (`s1-0088`) and the driver's handling of plan mode and of `/fork` under `noonsight run`.
Their results are not kept: each ran on a build this change replaced.
