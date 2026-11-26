# Delivery benchmark: measures

| | on-g2-s1-n1000 |
| --- | --- |
| Arm | `on` |
| Sessions measured / run | 1000 / 1000 |
| Requests (main, subagent, compaction) | 13184 (9432, 3088, 434) |
| Coverage | 100.0% (10329 of 10329) |
| Coverage, subagents | 100.0% (2430 of 2430) |
| Coverage, by rule | 100.0% |
| Own share | 78.4% |
| Right share | 49.3% |
| Characters added per request | 1370 |
| Share of the request text | 5.5% |
| Requests with a rule of another model and no note | 0 |
| Sessions with an unexplained violation | 0 |

## on-g2-s1-n1000

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| a /fork session | 115 | 115 | 100.0% | 76.4% | 0 |
| after /branch | 90 | 69 | 100.0% | 72.7% | 0 |
| after /clear | 186 | 162 | 100.0% | 93.6% | 0 |
| after /compact | 165 | 139 | 100.0% | 93.5% | 0 |
| after /fork | 45 | 41 | 100.0% | 65.7% | 0 |
| after /model | 571 | 474 | 100.0% | 58.8% | 0 |
| after /resume in the session | 33 | 30 | 100.0% | 75.7% | 0 |
| after a forking resume with --model | 30 | 27 | 100.0% | 66.1% | 0 |
| after a forking resume | 26 | 19 | 100.0% | 87.9% | 0 |
| after a resume with --model | 48 | 41 | 100.0% | 61.4% | 0 |
| after a resume | 36 | 30 | 100.0% | 82.9% | 0 |
| after an edit of tracked code | 1577 | 1356 | 100.0% | 78.2% | 0 |
| after another edit | 1083 | 898 | 100.0% | 77.1% | 0 |
| after leaving plan mode | 272 | 231 | 100.0% | 66.0% | 0 |
| after starting subagents that edit | 1081 | 854 | 100.0% | 79.1% | 0 |
| after starting subagents | 3545 | 2974 | 100.0% | 76.3% | 0 |
| in plan mode | 231 | 197 | 100.0% | 75.4% | 0 |
| start | 298 | 242 | 100.0% | 100.0% | 0 |
| subagent | 3088 | 2430 | 100.0% | 100.0% | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 297 | 3327 | 100.0% | 0 |
| two quiet steps in a row | 703 | 7002 | 100.0% | 0 |
| claude, in a project | 173 | 2185 | 100.0% | 0 |
| claude | 624 | 5862 | 100.0% | 0 |
| noonsight run, in a project | 45 | 512 | 100.0% | 0 |
| noonsight run | 158 | 1770 | 100.0% | 0 |
| 0-2 events | 80 | 403 | 100.0% | 0 |
| 3-5 events | 366 | 2781 | 100.0% | 0 |
| 6-8 events | 374 | 4435 | 100.0% | 0 |
| 9+ events | 180 | 2710 | 100.0% | 0 |
