# Delivery benchmark: measures

| | on-both-g2-s7-n20 | on-g2-s7-n20 | on-plugin-g2-s7-n20 |
| --- | --- | --- | --- |
| Arm | `on` | `on` | `on` |
| Sessions measured / run | 20 / 20 | 20 / 20 | 20 / 20 |
| Requests (main, subagent, compaction) | 313 (232, 72, 7) | 313 (232, 72, 7) | 319 (238, 72, 7) |
| Coverage | 100.0% (275 of 275) | 100.0% (274 of 274) | 100.0% (280 of 280) |
| Coverage, subagents | 100.0% (60 of 60) | 100.0% (60 of 60) | 100.0% (60 of 60) |
| Coverage, by rule | 100.0% | 100.0% | 100.0% |
| Own share | 72.2% | 72.4% | 71.9% |
| Right share | 45.9% | 46.2% | 45.9% |
| Characters added per request | 1931 | 1908 | 1921 |
| Share of the request text | 7.4% | 7.3% | 7.3% |
| Requests with a rule of another model and no note | 0 | 0 | 0 |
| Sessions with an unexplained violation | 0 | 0 | 0 |

## on-both-g2-s7-n20

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| a /fork session | 1 | 1 | 100.0% | 73.6% | 0 |
| after /branch | 2 | 1 | 100.0% | 100.0% | 0 |
| after /clear | 4 | 4 | 100.0% | 85.1% | 0 |
| after /compact | 3 | 3 | 100.0% | 100.0% | 0 |
| after /model | 9 | 7 | 100.0% | 46.5% | 0 |
| after a forking resume | 1 | 1 | 100.0% | 56.3% | 0 |
| after a resume with --model | 2 | 2 | 100.0% | 44.0% | 0 |
| after a resume | 1 | 1 | 100.0% | 100.0% | 0 |
| after an edit of tracked code | 36 | 33 | 100.0% | 67.5% | 0 |
| after another edit | 34 | 31 | 100.0% | 84.5% | 0 |
| after leaving plan mode | 4 | 2 | 100.0% | 60.1% | 0 |
| after starting subagents that edit | 23 | 23 | 100.0% | 68.3% | 0 |
| after starting subagents | 99 | 94 | 100.0% | 65.3% | 0 |
| in plan mode | 9 | 8 | 100.0% | 88.6% | 0 |
| start | 4 | 4 | 100.0% | 100.0% | 0 |
| subagent | 72 | 60 | 100.0% | 100.0% | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 9 | 149 | 100.0% | 0 |
| two quiet steps in a row | 11 | 126 | 100.0% | 0 |
| claude, in a project | 5 | 93 | 100.0% | 0 |
| claude | 13 | 138 | 100.0% | 0 |
| noonsight run, in a project | 2 | 44 | 100.0% | 0 |
| 0-2 events | 1 | 3 | 100.0% | 0 |
| 3-5 events | 6 | 45 | 100.0% | 0 |
| 6-8 events | 7 | 122 | 100.0% | 0 |
| 9+ events | 6 | 105 | 100.0% | 0 |

## on-g2-s7-n20

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| a /fork session | 1 | 1 | 100.0% | 73.6% | 0 |
| after /branch | 2 | 1 | 100.0% | 100.0% | 0 |
| after /clear | 4 | 4 | 100.0% | 85.1% | 0 |
| after /compact | 3 | 3 | 100.0% | 100.0% | 0 |
| after /model | 9 | 7 | 100.0% | 46.5% | 0 |
| after a forking resume | 1 | 1 | 100.0% | 56.3% | 0 |
| after a resume with --model | 2 | 2 | 100.0% | 44.0% | 0 |
| after a resume | 1 | 1 | 100.0% | 100.0% | 0 |
| after an edit of tracked code | 36 | 33 | 100.0% | 67.5% | 0 |
| after another edit | 34 | 31 | 100.0% | 84.5% | 0 |
| after leaving plan mode | 4 | 2 | 100.0% | 60.1% | 0 |
| after starting subagents that edit | 23 | 23 | 100.0% | 68.3% | 0 |
| after starting subagents | 99 | 93 | 100.0% | 65.5% | 0 |
| in plan mode | 9 | 8 | 100.0% | 88.6% | 0 |
| start | 4 | 4 | 100.0% | 100.0% | 0 |
| subagent | 72 | 60 | 100.0% | 100.0% | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 9 | 147 | 100.0% | 0 |
| two quiet steps in a row | 11 | 127 | 100.0% | 0 |
| claude, in a project | 5 | 92 | 100.0% | 0 |
| claude | 13 | 139 | 100.0% | 0 |
| noonsight run, in a project | 2 | 43 | 100.0% | 0 |
| 0-2 events | 1 | 3 | 100.0% | 0 |
| 3-5 events | 6 | 45 | 100.0% | 0 |
| 6-8 events | 7 | 123 | 100.0% | 0 |
| 9+ events | 6 | 103 | 100.0% | 0 |

## on-plugin-g2-s7-n20

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| a /fork session | 1 | 1 | 100.0% | 73.6% | 0 |
| after /branch | 2 | 1 | 100.0% | 100.0% | 0 |
| after /clear | 4 | 4 | 100.0% | 85.1% | 0 |
| after /compact | 3 | 3 | 100.0% | 100.0% | 0 |
| after /model | 9 | 7 | 100.0% | 46.5% | 0 |
| after a forking resume | 1 | 1 | 100.0% | 56.3% | 0 |
| after a resume with --model | 2 | 2 | 100.0% | 44.0% | 0 |
| after a resume | 1 | 1 | 100.0% | 100.0% | 0 |
| after an edit of tracked code | 36 | 33 | 100.0% | 67.5% | 0 |
| after another edit | 34 | 31 | 100.0% | 84.5% | 0 |
| after leaving plan mode | 4 | 2 | 100.0% | 60.1% | 0 |
| after starting subagents that edit | 23 | 23 | 100.0% | 68.3% | 0 |
| after starting subagents | 105 | 99 | 100.0% | 64.7% | 0 |
| in plan mode | 9 | 8 | 100.0% | 88.6% | 0 |
| start | 4 | 4 | 100.0% | 100.0% | 0 |
| subagent | 72 | 60 | 100.0% | 100.0% | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 9 | 152 | 100.0% | 0 |
| two quiet steps in a row | 11 | 128 | 100.0% | 0 |
| claude, in a project | 5 | 95 | 100.0% | 0 |
| claude | 13 | 141 | 100.0% | 0 |
| noonsight run, in a project | 2 | 44 | 100.0% | 0 |
| 0-2 events | 1 | 3 | 100.0% | 0 |
| 3-5 events | 6 | 46 | 100.0% | 0 |
| 6-8 events | 7 | 124 | 100.0% | 0 |
| 9+ events | 6 | 107 | 100.0% | 0 |
