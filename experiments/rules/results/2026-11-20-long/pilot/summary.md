# Rule effect experiment: pilot

20 runs of the arm none, Claude Code 2.1.329; $2.52 spent, as Claude Code reports cost.
A cell enters the design when at least 2 of its 5 pilot runs left a part undone.

| Model | Task | Pilot runs | Left a part undone | Parts done | Enters the design | Cost per run, measured | Cost per run, expected |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sonnet | migrate | 5 | 0 of 5 | 19.0 of 19 | no | $0.303 | $0.350 |
| sonnet | backlog | 5 | 0 of 5 | 8.0 of 8 | no | $0.173 | $0.500 |
| haiku | migrate | 5 | 0 of 5 | 19.0 of 19 | no | $0.016 | $0.030 |
| haiku | backlog | 5 | 1 of 5 | 7.8 (7.0 to 8.0) of 8 | no | $0.011 | $0.050 |

## The design after the pilot

No cell enters, so the design does not run.

