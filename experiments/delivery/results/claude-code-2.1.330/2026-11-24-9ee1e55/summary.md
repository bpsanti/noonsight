# Delivery benchmark: measures

| | claudemd-g2-s1-n1000 | on-g2-s1-n1000 | skills-g2-s1-n1000 |
| --- | --- | --- | --- |
| Arm | `claudemd` | `on` | `skills` |
| Sessions measured / run | 1000 / 1000 | 997 / 1000 | 1000 / 1000 |
| Requests (main, subagent, compaction) | 13282 (9484, 3088, 434) | 13089 (9355, 3073, 433) | 13306 (9508, 3088, 434) |
| Coverage | 88.2% (8656 of 9816) | 99.9% (10237 of 10245) | 0.0% (0 of 9833) |
| Coverage, subagents | 48.3% (1082 of 2242) | 100.0% (2417 of 2417) | 0.0% (0 of 2242) |
| Coverage, by rule | 90.7% | 100.0% | 0.0% |
| Own share | 32.3% | 78.3% | no rule text |
| Right share | 12.2% | 49.2% | no rule text |
| Characters added per request | 4509 | 1372 | 0 |
| Share of the request text | 15.4% | 5.5% | 0.0% |
| Requests with a rule of another model and no note | 10897 | 7 | 0 |
| Sessions with an unexplained violation | 1000 | 4 | 937 |

## claudemd-g2-s1-n1000

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| a /fork session | 138 | 138 | 100.0% | 32.8% | 138 |
| after /branch | 90 | 63 | 100.0% | 30.5% | 90 |
| after /clear | 186 | 150 | 100.0% | 31.3% | 186 |
| after /compact | 165 | 135 | 100.0% | 33.1% | 165 |
| after /fork | 45 | 39 | 100.0% | 32.4% | 45 |
| after /model | 571 | 448 | 100.0% | 32.1% | 571 |
| after /resume in the session | 33 | 28 | 100.0% | 28.9% | 33 |
| after a forking resume with --model | 30 | 24 | 100.0% | 31.7% | 30 |
| after a forking resume | 26 | 19 | 100.0% | 27.5% | 26 |
| after a resume with --model | 48 | 41 | 100.0% | 30.1% | 48 |
| after a resume | 36 | 29 | 100.0% | 34.2% | 36 |
| after an edit of tracked code | 1577 | 1314 | 100.0% | 31.9% | 1577 |
| after another edit | 1083 | 849 | 100.0% | 32.9% | 1083 |
| after leaving plan mode | 272 | 217 | 100.0% | 31.9% | 272 |
| after starting subagents that edit | 1078 | 822 | 100.0% | 32.5% | 1078 |
| after starting subagents | 3577 | 2838 | 100.0% | 32.2% | 3577 |
| in plan mode | 231 | 190 | 100.0% | 34.5% | 231 |
| start | 298 | 230 | 100.0% | 32.0% | 298 |
| subagent | 3088 | 2242 | 48.3% | 32.2% | 1413 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 297 | 3130 | 87.0% | 297 |
| two quiet steps in a row | 703 | 6686 | 88.8% | 703 |
| claude | 1000 | 9816 | 88.2% | 1000 |
| 0-2 events | 80 | 370 | 91.1% | 80 |
| 3-5 events | 366 | 2627 | 88.5% | 366 |
| 6-8 events | 374 | 4225 | 88.5% | 374 |
| 9+ events | 180 | 2594 | 86.9% | 180 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 1000 | claudemd-g2-s1-0000 |
| foreign-unretired/subagent | 496 | claudemd-g2-s1-0000 |
| missing-own/subagent | 413 | claudemd-g2-s1-0000 |

## on-g2-s1-n1000

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| a /fork session | 113 | 113 | 100.0% | 76.3% | 0 |
| after /branch | 92 | 71 | 100.0% | 73.0% | 0 |
| after /clear | 187 | 163 | 100.0% | 92.8% | 0 |
| after /compact | 167 | 141 | 98.6% | 92.9% | 2 |
| after /fork | 46 | 41 | 100.0% | 65.7% | 0 |
| after /model | 574 | 476 | 100.0% | 58.9% | 1 |
| after /resume in the session | 33 | 30 | 100.0% | 75.7% | 0 |
| after a forking resume with --model | 30 | 27 | 100.0% | 66.1% | 0 |
| after a forking resume | 26 | 19 | 100.0% | 87.9% | 0 |
| after a resume with --model | 48 | 41 | 100.0% | 61.4% | 0 |
| after a resume | 36 | 30 | 100.0% | 82.9% | 0 |
| after an edit of tracked code | 1570 | 1349 | 100.0% | 78.1% | 0 |
| after another edit | 1076 | 891 | 100.0% | 77.1% | 0 |
| after leaving plan mode | 271 | 230 | 100.0% | 65.8% | 1 |
| after starting subagents that edit | 1061 | 842 | 100.0% | 79.0% | 0 |
| after starting subagents | 3496 | 2925 | 99.8% | 76.1% | 3 |
| in plan mode | 231 | 197 | 100.0% | 75.4% | 0 |
| start | 298 | 242 | 100.0% | 100.0% | 0 |
| subagent | 3073 | 2417 | 100.0% | 100.0% | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 297 | 3321 | 100.0% | 0 |
| two quiet steps in a row | 700 | 6924 | 99.9% | 4 |
| claude, in a project | 173 | 2176 | 99.9% | 1 |
| claude | 622 | 5820 | 99.9% | 2 |
| noonsight run, in a project | 45 | 512 | 100.0% | 0 |
| noonsight run | 157 | 1737 | 99.8% | 1 |
| 0-2 events | 80 | 403 | 100.0% | 0 |
| 3-5 events | 365 | 2743 | 99.9% | 1 |
| 6-8 events | 373 | 4422 | 100.0% | 0 |
| 9+ events | 179 | 2677 | 99.8% | 3 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 3 | on-g2-s1-0345 |
| missing-own/main | 2 | on-g2-s1-0345 |
| own-retired/main | 1 | on-g2-s1-0564 |

## skills-g2-s1-n1000

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| a /fork session | 138 | 138 | 0.0% | no rule text | 0 |
| after /branch | 90 | 63 | 0.0% | no rule text | 0 |
| after /clear | 186 | 150 | 0.0% | no rule text | 0 |
| after /compact | 165 | 135 | 0.0% | no rule text | 0 |
| after /fork | 45 | 39 | 0.0% | no rule text | 0 |
| after /model | 571 | 448 | 0.0% | no rule text | 0 |
| after /resume in the session | 33 | 28 | 0.0% | no rule text | 0 |
| after a forking resume with --model | 30 | 24 | 0.0% | no rule text | 0 |
| after a forking resume | 26 | 19 | 0.0% | no rule text | 0 |
| after a resume with --model | 48 | 41 | 0.0% | no rule text | 0 |
| after a resume | 36 | 29 | 0.0% | no rule text | 0 |
| after an edit of tracked code | 1577 | 1314 | 0.0% | no rule text | 0 |
| after another edit | 1083 | 849 | 0.0% | no rule text | 0 |
| after leaving plan mode | 272 | 217 | 0.0% | no rule text | 0 |
| after starting subagents that edit | 1073 | 814 | 0.0% | no rule text | 0 |
| after starting subagents | 3606 | 2863 | 0.0% | no rule text | 0 |
| in plan mode | 231 | 190 | 0.0% | no rule text | 0 |
| start | 298 | 230 | 0.0% | no rule text | 0 |
| subagent | 3088 | 2242 | 0.0% | no rule text | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 297 | 3134 | 0.0% | 275 |
| two quiet steps in a row | 703 | 6699 | 0.0% | 662 |
| claude | 1000 | 9833 | 0.0% | 937 |
| 0-2 events | 80 | 369 | 0.0% | 69 |
| 3-5 events | 366 | 2628 | 0.0% | 333 |
| 6-8 events | 374 | 4229 | 0.0% | 359 |
| 9+ events | 180 | 2607 | 0.0% | 176 |

| Violation | Sessions | Example |
| --- | --- | --- |
| missing-own/main | 873 | skills-g2-s1-0000 |
| missing-own/subagent | 508 | skills-g2-s1-0000 |
