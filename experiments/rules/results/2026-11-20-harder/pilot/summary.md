# Rule effect experiment: pilot

20 runs of the arm none, Claude Code 2.1.329; $2.57 spent, as Claude Code reports cost.
A cell enters the design when at least 2 of its 5 pilot runs left a part undone.

| Model | Task | Pilot runs | Left a part undone | Parts done | Enters the design | Cost per run, measured | Cost per run, expected |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sonnet | codes | 5 | 0 of 5 | 39.0 of 39 | no | $0.183 | $0.600 |
| sonnet | triage | 5 | 4 of 5 | 11.0 (10.0 to 12.0) of 12 | yes | $0.292 | $0.350 |
| haiku | codes | 5 | 0 of 5 | 39.0 of 39 | no | $0.020 | $0.035 |
| haiku | triage | 5 | 5 of 5 | 11.0 of 12 | yes | $0.019 | $0.025 |

## The design after the pilot

2 of the 4 cells enter: sonnet on triage, haiku on triage, 80 runs each (40 per arm), 160 runs in all.

At the expected cost per run, they cost $30.00; at the cost the pilot measured, $24.82. The design's cap is $110.00.
The runs of the arm with the rules can cost more than the pilot's, which ran without them.

