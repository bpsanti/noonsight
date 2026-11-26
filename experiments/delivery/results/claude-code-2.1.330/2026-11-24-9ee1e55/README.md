# Delivery benchmark, Claude Code 2.1.330, 2026-11-24, 1000 sequences

> **Superseded in part.** The arm `on` by [2026-11-25, after the fixes of F10 to F12](../2026-11-25-6989ada/README.md) (Claude Code 2.1.330); `claudemd` and `skills` are current.

The design [`native-n1000`](../../../README.md#the-design-native-n1000): noonsight, a user `CLAUDE.md` and a skill per model on the same 1000 sequences of generator 2, seed 1, so the arms compare on the same sample.
No request reached Anthropic and no token was spent.
This is the current run of `claudemd` and `skills`, and its `on` arm, the build before the fixes of F10 to F12, is superseded: [docs/evidence.md](../../../../../docs/evidence.md#delivery) gives its numbers (D40 to D42, D44, D51, D58, D60 and D62, and the superseded D35 to D39, D45, D47 and D49).
`rules`, the corpus, the self-check and the hook times were not run; their latest results are in [2026-11-23](../2026-11-23-c5b9130/README.md), superseded for the rest.

## How it ran

Every session ran Claude Code 2.1.330 with the noonsight build of `c5b9130` (preset `claude` 1.3.1), installed through `--noonsight`, with the harness of this repository at `9ee1e55`, 2 sessions at once, on a laptop with 8 cores (macOS, arm64).
The harness sources did not change between `9ee1e55`, where the design was registered, and `acb4a8d`, which dropped the `rules` arm from it while `on` was running; `run.json` names the second for the commands that ended after it.
`on` was stopped once, at 477 finished sessions, and continued about three and a half hours later; the two sessions in flight were discarded and ran again in full, and its time in `run.json` covers the second part only.
The machine was busy with other work during the first part (load averages up to 160) and nearly free in the second.

## The result

| Arm | Sessions measured | Coverage | Subagents | Own share | Characters per request | Requests with another model's rule and no note | Sessions that broke the invariant |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `on` | 997 of 1,000 | 99.9% (10,237 of 10,245) | 100% (2,417 of 2,417) | 78.3% | 1,372 | 7 | 4 |
| `claudemd` | 1,000 of 1,000 | 88.2% (8,656 of 9,816) | 48.3% (1,082 of 2,242) | 32.3% | 4,509 | 10,897 | 1,000 |
| `skills` | 1,000 of 1,000 | 0% (0 of 9,833) | 0% (0 of 2,242) | no rule text | 0 | 0 | 937 |

The requests with rules due differ between the arms as the design says: under a native arm a session drawn to start in the project is measured against the reference without the project.
The three `on` sessions left out could not be driven: `s1-0373` (`step-timeout`, a turn with no answer), `s1-0420` (`fork-timeout`) and `s1-0466` (`wrong-mode`); all three ran in the first part, on the loaded machine.
The native arms ran all their sessions, so no arm reached the threshold for running again.

## The comparisons

[comparison.md](comparison.md): the four primary comparisons are supported, each with an adjusted p below 0.001.
On the 997 sequences both arms ran, 542 sessions had a subagent request without its rules under `claudemd` and not under `on`, and none the other way; for `skills`, 631 and none.
For every request, 3 sessions lacked a rule under `on` and not under `claudemd` (`s1-0345`, `s1-0564`, `s1-0949`), against 542 the other way.

One control does not hold.
`claudemd` on its first 60 sequences gives 88.4% (516 of 584), where the run before, superseded, gave 88.2%: the same 60 of 128 subagent requests, and 456 requests of the main conversation with rules due instead of 448, all covered in both.
The number of requests a session makes is not fixed by its sequence; the three native arms differed in the run before too (576, 578 and 579 due over the same 60 sequences).
The other five controls hold, among them `on` on its first 300 sequences, with no failing session and full subagent coverage.

## The failures

Four sessions break the invariant under `on`, 8 requests without a right rule and 7 with another model's rule and no note, all in the session's own conversation; every one had two quiet steps in a row.
Each was read and shrunk, and they are three failures, F10 to F12 of [the delivery README](../../../README.md#failures-found-and-a-limit), recorded and not fixed here:

| Failure | Session | Shortest reproduction |
| --- | --- | --- |
| F10 | `s1-0345` | `start(sonnet) > turn > /plan > /model haiku > /compact > turn` ([shrunk](failures/shrink-on-g2-s1-0345-missing-own-main.json)) |
| F10 | `s1-0969` | `start(sonnet) > /plan > /model opus > turn > /model sonnet > /model haiku > /compact > turn` ([shrunk](failures/shrink-on-g2-s1-0969-foreign-unretired-main.json)) |
| F11 | `s1-0564` | `start(haiku) > /model fable > turn > resume --model haiku > turn > /compact > resume > turn` ([shrunk](failures/shrink-on-g2-s1-0564-own-retired-main.json)) |
| F12 | `s1-0949` | `start(fable, noonsight run) > turn > spawn > /compact > resume --fork-session > turn` ([by hand](failures/by-hand-on-g2-s1-0949-missing-own-main.json)) |

The shrinker keeps the class of a violation, not its cause: for `s1-0949` it ended on the documented limit `limit-default-model-after-compact` ([shrunk](failures/shrink-on-g2-s1-0949-missing-own-main.json)), where Claude Code runs another model after a compaction.
In `s1-0949` the conversation goes on on Fable, and the decision log of the fork says `already-delivered`, so its reproduction was written by hand, and each reproduction of the table fails on the measured build and on the build of `acb4a8d` (one session of each on each build).

## The decision log

[agree.json](agree.json): on the 997 sessions, the log says every request of the session's own conversation was covered, and the stub saw 99.9%; they name the same model on 9,346 of the 9,355 requests.
The log records what the hook returned, so it cannot see the deliveries these failures miss.
