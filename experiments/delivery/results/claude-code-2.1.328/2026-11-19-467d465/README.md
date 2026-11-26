# Delivery benchmark, Claude Code 2.1.328, 2026-11-19

> **Superseded.** The current runs are [2026-11-25](../../claude-code-2.1.330/2026-11-25-6989ada/README.md) for `on`, [2026-11-24](../../claude-code-2.1.330/2026-11-24-9ee1e55/README.md) for `claudemd` and `skills`, and, for what neither ran, [2026-11-23](../../claude-code-2.1.330/2026-11-23-c5b9130/README.md), all on Claude Code 2.1.330; quote its numbers, not the ones here, which are history.

The first full run of the delivery benchmark ([experiments/delivery](../../../README.md)), on Claude Code 2.1.328 and the `claude` preset 1.3.1, on a laptop with 8 cores (macOS, arm64) shared with other heavy work the whole time.
`npm run delivery -- all --concurrency 6` ran at commit `467d465` and took 85 minutes.
The self-check was run again at `0c072b7`, after a fix to the shrinker: its candidates had shared the session directory of the session they came from, so candidates run at the same time could clash.
The fix changes neither the sessions nor the measures, and the planted runs were not repeated.
`run.json` lists each command with its commit.
No request reached Anthropic and no token was spent.

These results predate the fixes of F1 and F2, the two failures the fuzzer found here: they measure noonsight as it was at `467d465`, and the corpus then expected the F1 and F2 entries to fail.
The corpus on the fixed build is in [the next folder](../2026-11-19-f02ccf0/README.md).

## Corpus

All 16 entries had the outcome they record ([corpus.json](corpus.json)): the 9 sequences expected to pass broke no part of the invariant, and the 7 that reproduce F1 and F2 showed every violation they name.

## Fuzz under `on`

300 sessions of seed 1; 296 ran to the end, and 4 stopped on a step whose answer never came (`step-timeout`), which leaves them out of the measures.

| Measure | Value |
| --- | --- |
| Coverage | 99.4% of the requests with rules due (3,071 of 3,090); 99.7% by rule; subagents 99.7% (653 of 655) |
| Own share | 78.4% of the rule text in a request was written for the request's model |
| Right share | 52.5%: the first copy of each right rule, over all rule text plus envelopes and notes |
| Cost | 1,132 characters per request (about 283 tokens at 4 characters each), 4.7% of the request text in these short test requests |
| Robustness | 26 of 296 sessions broke the invariant somewhere; 80 requests had another model's rule with no note, 10 lacked a right rule, 9 had their own rules retired by a note |

The cut that explains every violation: in the 122 sessions where every quiet step (`/model`, `/compact`, `/clear`, resume) is followed by a request before the next one, coverage was 100% (1,285 of 1,285) and no session broke the invariant; all 26 failing sessions have two quiet steps in a row.
The own share after `/model` is 56.2%, since the earlier model's rules stay in the conversation, retired by the note, until a compaction or `/clear`.
The tables by path, by number of lifecycle events and by class of violation are in [summary.md](summary.md).

The failing sessions show the classes the F1 and F2 corpus entries show.
Two of them were shrunk ([failures/](failures)), each to a corpus entry: `on-s1-0170` to `start(haiku) > /model sonnet > /model fable > turn` (`f1-two-switches`) in 7 runs, and `on-s1-0174` to `start(sonnet) > turn > resume --model opus > resume > spawn(Plan)` (`f2-subagent-after-resume`) in 18 runs.
The shrinker keeps the class of a violation, not its cause, so the other sessions are not each attributed here.

## The native alternatives

The first 60 sessions of the same seed under each arm; every session ran.

| Arm | Coverage | Subagents | Own share | Characters per request | Requests with another model's rule and no note |
| --- | --- | --- | --- | --- | --- |
| `claudemd` | 87.2% (557 of 639) | 32.2% (39 of 121) | 31.6% | 4,405 | 696 |
| `rules` | 70.6% (448 of 635) | 32.5% (39 of 120) | 27.4% | 3,972 | 691 |
| `skills` | 0% (0 of 643) | 0% | no rule text | 0 | 0 |

A `CLAUDE.md` or `.claude/rules` file is in every request of the session, whatever the path, so their coverage of the session's own conversation is high; they do not reach the `Explore` and `Plan` subagents, and every model reads the other models' rules with nothing to say they do not apply to it.
The path-scoped `.claude/rules` files load only once the agent reads a matching file, so the rules noonsight delivers from the start for a scope arrive late or not at all.
A skill's body reaches the session only if the agent opens it, and the stub never does: the arm guarantees nothing.

## Self-check

[selfcheck.json](selfcheck.json), with the shrunk sequences in [failures/](failures).

| Plant | Sessions failing on the planted build and not on the real one | Exposed sessions caught | Shrunk to | On the real build |
| --- | --- | --- | --- | --- |
| `no-switch-note` | 24 of 59 | 24 of 26 | `start(haiku) > /model opus > turn`, in 5 runs | passes |
| `compact-as-resume` | 11 of 59 | 11 of 12 | `start(opus) > turn > /compact > turn`, in 12 runs | passes |

The three exposed sessions not caught were read one by one.
`s1-0022`: the other model's rule in its requests is retired by the note of a later resume, which the plant leaves in place, so the session was not exposed; the criterion counts it because a `/model` note is also in those requests.
`s1-0058`: the real build already breaks the invariant there, in the same class, because of F1, so the plant adds nothing the comparison can see.
`s1-0020`: a resume's delivery was still pending when the compaction came, and it reached the next request anyway, so the plant changed nothing there.

## The decision log against the stub

[agree.json](agree.json), on the 296 `on` sessions: replaying each session's decision log gives the same model, the same rules due, the same coverage and the same characters as the stub saw in 2,842 of 3,121 requests of the sessions' own conversations.
By the log, coverage is 100%; by the stub, 99.3%.
Every one of the 60 sessions where they differ has two quiet steps in a row: the log records what the hook returned, and that is what Claude Code dropped there.

## Hook time

[hooktime.json](hooktime.json), 40 runs of each hook with the recorded inputs; when it ended, the load averages over the last 1, 5 and 15 minutes were 22, 64 and 131.
Processor time, median: 60 ms for `session-start`, `model-switch` and each of the three subagent hooks, 100 ms for the first edit of a tracked code file (it runs git) and 50 ms for later edits, against 20 ms for a Node.js process that does nothing.
Wall times are in the file; on a machine this busy they say more about the machine than about the hooks.
