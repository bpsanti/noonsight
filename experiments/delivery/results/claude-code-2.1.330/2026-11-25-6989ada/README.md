# Delivery benchmark, Claude Code 2.1.330, 2026-11-25, `on` after F10 to F12

The design [`on-n1000-after-f10-f12`](../../../README.md#the-design-on-n1000-after-f10-f12): noonsight's arm again on the 1000 sequences of [the run of 2026-11-24](../2026-11-24-9ee1e55/README.md) (Claude Code 2.1.330), on the build with the fixes of F10 to F12.
No request reached Anthropic and no token was spent.
This is the current run of `on`: [docs/evidence.md](../../../../../docs/evidence.md#delivery) gives its numbers (D52 to D57, D59 and D61).
`claudemd` and `skills` were not run again, since nothing of noonsight's delivery runs in them: their current run is that of 2026-11-24, whose sessions the comparisons pair with these.

## How it ran

Every session ran Claude Code 2.1.330 with the noonsight build of `eea03f7` (preset `claude` 1.3.1), installed through `--noonsight`, with the harness of this repository at `6989ada`, where the design was registered before any counted session, 2 sessions at once, on the laptop of the run before (8 cores, macOS, arm64).
Between `9ee1e55`, the harness of the run before, and `6989ada`, no source of the harness, the resolver (`src/core`) or the preset changed; the build of noonsight is the only change.
The run started at night and was not interrupted.

## The result

| `on` | Sessions measured | Coverage | Subagents | Own share | Characters per request | Requests with another model's rule and no note | Sessions that broke the invariant |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-24, build `c5b9130` | 997 of 1,000 | 99.9% (10,237 of 10,245) | 100% (2,417 of 2,417) | 78.3% | 1,372 | 7 | 4 |
| 2026-11-25, build `eea03f7` | 1,000 of 1,000 | 100% (10,329 of 10,329) | 100% (2,430 of 2,430) | 78.4% | 1,370 | 0 | 0 |

Every session ran to the end, among them the three that the driver could not run in the run before (`s1-0373`, `s1-0420` and `s1-0466`), so nothing reached the threshold for running again.
No session breaks the invariant, so there was nothing to shrink.
The number of requests a session makes is not fixed by its sequence, as the run before found for the native arms, so the counts differ slightly between the two runs of the same sequences.

## The comparisons

[comparison.md](comparison.md): the four primary comparisons are supported, each with an adjusted p below 0.001.
On the 1000 sequences, 543 sessions had a subagent request without its rules under `claudemd` and none under `on`, and none the other way; for `skills`, 633 and none.
For every request, 543 sessions lacked a rule under `claudemd` and not under `on`, and 949 under `skills`, and none the other way.
Against the run before, the four failing sessions (`s1-0345`, `s1-0564`, `s1-0949`, `s1-0969`) pass, and no session that passed then fails now; with four sessions a paired test cannot reach the alpha, so these comparisons are read from the measure alone, and they hold.

## The decision log

[agree.json](agree.json): on the 1000 sessions, the log and the stub both say every request of the session's own conversation with rules due was covered.
