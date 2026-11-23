# Delivery benchmark: measures

| | claudemd-g2-s1-n60 | on-g2-s1-n300 | plant-compact-as-resume-g2-s1-n60 | plant-fork-unknown-g2-s1-n60 | plant-no-switch-note-g2-s1-n60 | rules-g2-s1-n60 | skills-g2-s1-n60 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Arm | `claudemd` | `on` | `on` (planted: compact-as-resume) | `on` (planted: fork-unknown) | `on` (planted: no-switch-note) | `rules` | `skills` |
| Sessions measured / run | 60 / 60 | 299 / 300 | 60 / 60 | 60 / 60 | 60 / 60 | 60 / 60 | 60 / 60 |
| Requests (main, subagent, compaction) | 761 (537, 183, 27) | 3984 (2804, 970, 136) | 761 (537, 183, 27) | 764 (540, 183, 27) | 765 (541, 183, 27) | 764 (540, 183, 27) | 764 (540, 183, 27) |
| Coverage | 88.2% (508 of 576) | 100.0% (3090 of 3090) | 98.7% (600 of 608) | 98.9% (606 of 613) | 100.0% (613 of 613) | 76.3% (441 of 578) | 0.0% (0 of 579) |
| Coverage, subagents | 46.9% (60 of 128) | 100.0% (763 of 763) | 100.0% (137 of 137) | 100.0% (137 of 137) | 100.0% (137 of 137) | 46.9% (60 of 128) | 0.0% (0 of 128) |
| Coverage, by rule | 90.3% | 100.0% | 97.8% | 99.3% | 100.0% | 80.7% | 0.0% |
| Own share | 32.6% | 78.5% | 79.0% | 79.2% | 79.0% | 27.9% | no rule text |
| Right share | 12.0% | 48.5% | 51.1% | 50.5% | 54.6% | 12.2% | no rule text |
| Characters added per request | 4472 | 1343 | 1279 | 1305 | 1226 | 3889 | 0 |
| Share of the request text | 15.4% | 5.4% | 5.2% | 5.3% | 5.0% | 13.7% | 0.0% |
| Requests with a rule of another model and no note | 619 | 0 | 0 | 19 | 127 | 622 | 0 |
| Sessions with an unexplained violation | 60 | 0 | 4 | 7 | 32 | 60 | 55 |

## claudemd-g2-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| a /fork session | 7 | 7 | 100.0% | 36.6% | 7 |
| after /branch | 12 | 11 | 100.0% | 31.7% | 12 |
| after /clear | 11 | 9 | 100.0% | 30.0% | 11 |
| after /compact | 7 | 5 | 100.0% | 29.8% | 7 |
| after /fork | 2 | 1 | 100.0% | 28.5% | 2 |
| after /model | 34 | 27 | 100.0% | 33.4% | 34 |
| after /resume in the session | 4 | 3 | 100.0% | 33.1% | 4 |
| after a forking resume with --model | 2 | 1 | 100.0% | 23.1% | 2 |
| after a resume | 3 | 2 | 100.0% | 28.2% | 3 |
| after an edit of tracked code | 89 | 89 | 100.0% | 35.1% | 89 |
| after another edit | 42 | 33 | 100.0% | 33.8% | 42 |
| after leaving plan mode | 17 | 14 | 100.0% | 34.6% | 17 |
| after starting subagents that edit | 53 | 46 | 100.0% | 32.8% | 53 |
| after starting subagents | 227 | 182 | 100.0% | 31.5% | 227 |
| in plan mode | 16 | 11 | 100.0% | 33.7% | 16 |
| start | 11 | 7 | 100.0% | 34.1% | 11 |
| subagent | 183 | 128 | 46.9% | 32.2% | 82 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 14 | 121 | 90.1% | 14 |
| two quiet steps in a row | 46 | 455 | 87.7% | 46 |
| claude | 60 | 576 | 88.2% | 60 |
| 0-2 events | 6 | 32 | 93.8% | 6 |
| 3-5 events | 23 | 134 | 87.3% | 23 |
| 6-8 events | 23 | 286 | 88.1% | 23 |
| 9+ events | 8 | 124 | 87.9% | 8 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 60 | claudemd-g2-s1-0000 |
| foreign-unretired/subagent | 31 | claudemd-g2-s1-0000 |
| missing-own/subagent | 25 | claudemd-g2-s1-0000 |

## on-g2-s1-n300

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| a /fork session | 37 | 37 | 100.0% | 73.9% | 0 |
| after /branch | 26 | 23 | 100.0% | 70.7% | 0 |
| after /clear | 48 | 40 | 100.0% | 94.4% | 0 |
| after /compact | 48 | 41 | 100.0% | 97.3% | 0 |
| after /fork | 14 | 12 | 100.0% | 76.6% | 0 |
| after /model | 170 | 137 | 100.0% | 56.0% | 0 |
| after /resume in the session | 13 | 12 | 100.0% | 72.7% | 0 |
| after a forking resume with --model | 8 | 8 | 100.0% | 52.4% | 0 |
| after a forking resume | 7 | 6 | 100.0% | 87.1% | 0 |
| after a resume with --model | 12 | 10 | 100.0% | 70.6% | 0 |
| after a resume | 8 | 7 | 100.0% | 88.1% | 0 |
| after an edit of tracked code | 385 | 347 | 100.0% | 78.8% | 0 |
| after another edit | 336 | 260 | 100.0% | 76.7% | 0 |
| after leaving plan mode | 83 | 72 | 100.0% | 66.8% | 0 |
| after starting subagents that edit | 298 | 223 | 100.0% | 77.4% | 0 |
| after starting subagents | 1138 | 947 | 100.0% | 77.9% | 0 |
| in plan mode | 70 | 60 | 100.0% | 74.4% | 0 |
| start | 103 | 85 | 100.0% | 100.0% | 0 |
| subagent | 970 | 763 | 100.0% | 100.0% | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 92 | 1042 | 100.0% | 0 |
| two quiet steps in a row | 207 | 2048 | 100.0% | 0 |
| claude, in a project | 54 | 674 | 100.0% | 0 |
| claude | 186 | 1782 | 100.0% | 0 |
| noonsight run, in a project | 13 | 114 | 100.0% | 0 |
| noonsight run | 46 | 520 | 100.0% | 0 |
| 0-2 events | 27 | 154 | 100.0% | 0 |
| 3-5 events | 109 | 804 | 100.0% | 0 |
| 6-8 events | 113 | 1380 | 100.0% | 0 |
| 9+ events | 50 | 752 | 100.0% | 0 |

## plant-compact-as-resume-g2-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| a /fork session | 7 | 7 | 100.0% | 72.3% | 0 |
| after /branch | 12 | 11 | 100.0% | 75.0% | 0 |
| after /clear | 11 | 9 | 100.0% | 83.3% | 0 |
| after /compact | 7 | 6 | 66.7% | 86.7% | 0 |
| after /fork | 2 | 2 | 100.0% | 51.0% | 0 |
| after /model | 34 | 29 | 100.0% | 64.3% | 0 |
| after /resume in the session | 4 | 3 | 100.0% | 75.6% | 0 |
| after a forking resume with --model | 2 | 2 | 100.0% | 53.2% | 0 |
| after a resume | 3 | 2 | 100.0% | 85.5% | 0 |
| after an edit of tracked code | 89 | 89 | 94.4% | 79.7% | 0 |
| after another edit | 42 | 33 | 100.0% | 94.1% | 0 |
| after leaving plan mode | 17 | 16 | 93.8% | 71.1% | 0 |
| after starting subagents that edit | 54 | 47 | 100.0% | 76.2% | 0 |
| after starting subagents | 226 | 193 | 100.0% | 74.3% | 0 |
| in plan mode | 16 | 14 | 100.0% | 85.0% | 0 |
| start | 11 | 8 | 100.0% | 100.0% | 0 |
| subagent | 183 | 137 | 100.0% | 100.0% | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 14 | 138 | 98.6% | 2 |
| two quiet steps in a row | 46 | 470 | 98.7% | 2 |
| claude, in a project | 10 | 106 | 94.3% | 2 |
| claude | 38 | 369 | 99.5% | 2 |
| noonsight run, in a project | 4 | 35 | 100.0% | 0 |
| noonsight run | 8 | 98 | 100.0% | 0 |
| 0-2 events | 6 | 36 | 97.2% | 1 |
| 3-5 events | 23 | 144 | 99.3% | 1 |
| 6-8 events | 23 | 297 | 98.3% | 1 |
| 9+ events | 8 | 131 | 99.2% | 1 |

| Violation | Sessions | Example |
| --- | --- | --- |
| missing-own/main | 4 | plant-compact-as-resume-g2-s1-0000 |

## plant-fork-unknown-g2-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| a /fork session | 7 | 7 | 100.0% | 70.9% | 2 |
| after /branch | 12 | 11 | 100.0% | 82.1% | 2 |
| after /clear | 11 | 9 | 100.0% | 83.3% | 0 |
| after /compact | 7 | 6 | 100.0% | 89.4% | 0 |
| after /fork | 2 | 2 | 100.0% | 51.0% | 0 |
| after /model | 34 | 29 | 100.0% | 65.8% | 0 |
| after /resume in the session | 4 | 3 | 100.0% | 75.6% | 0 |
| after a forking resume with --model | 2 | 2 | 100.0% | 57.4% | 1 |
| after a resume | 3 | 2 | 100.0% | 85.5% | 0 |
| after an edit of tracked code | 89 | 89 | 100.0% | 81.0% | 3 |
| after another edit | 42 | 33 | 90.9% | 93.9% | 0 |
| after leaving plan mode | 17 | 16 | 100.0% | 71.9% | 1 |
| after starting subagents that edit | 55 | 48 | 100.0% | 76.0% | 0 |
| after starting subagents | 228 | 197 | 98.0% | 73.5% | 9 |
| in plan mode | 16 | 14 | 100.0% | 85.0% | 1 |
| start | 11 | 8 | 100.0% | 100.0% | 0 |
| subagent | 183 | 137 | 100.0% | 100.0% | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 14 | 139 | 100.0% | 0 |
| two quiet steps in a row | 46 | 474 | 98.5% | 7 |
| claude, in a project | 10 | 106 | 100.0% | 1 |
| claude | 38 | 373 | 98.1% | 5 |
| noonsight run, in a project | 4 | 35 | 100.0% | 1 |
| noonsight run | 8 | 99 | 100.0% | 0 |
| 0-2 events | 6 | 37 | 100.0% | 0 |
| 3-5 events | 23 | 144 | 100.0% | 1 |
| 6-8 events | 23 | 298 | 100.0% | 4 |
| 9+ events | 8 | 134 | 94.8% | 2 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 6 | plant-fork-unknown-g2-s1-0027 |
| missing-own/main | 1 | plant-fork-unknown-g2-s1-0049 |

## plant-no-switch-note-g2-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| a /fork session | 7 | 7 | 100.0% | 72.3% | 0 |
| after /branch | 12 | 11 | 100.0% | 75.0% | 1 |
| after /clear | 11 | 9 | 100.0% | 83.3% | 0 |
| after /compact | 7 | 6 | 100.0% | 89.4% | 1 |
| after /fork | 2 | 2 | 100.0% | 51.0% | 0 |
| after /model | 34 | 29 | 100.0% | 64.8% | 21 |
| after /resume in the session | 4 | 3 | 100.0% | 75.6% | 0 |
| after a forking resume with --model | 2 | 2 | 100.0% | 53.2% | 0 |
| after a resume | 3 | 2 | 100.0% | 85.5% | 0 |
| after an edit of tracked code | 89 | 89 | 100.0% | 80.8% | 19 |
| after another edit | 42 | 33 | 100.0% | 94.1% | 3 |
| after leaving plan mode | 17 | 16 | 100.0% | 71.9% | 7 |
| after starting subagents that edit | 54 | 48 | 100.0% | 75.1% | 26 |
| after starting subagents | 230 | 197 | 100.0% | 73.8% | 47 |
| in plan mode | 16 | 14 | 100.0% | 85.0% | 2 |
| start | 11 | 8 | 100.0% | 100.0% | 0 |
| subagent | 183 | 137 | 100.0% | 100.0% | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 14 | 140 | 100.0% | 6 |
| two quiet steps in a row | 46 | 473 | 100.0% | 26 |
| claude, in a project | 10 | 107 | 100.0% | 6 |
| claude | 38 | 371 | 100.0% | 20 |
| noonsight run, in a project | 4 | 35 | 100.0% | 3 |
| noonsight run | 8 | 100 | 100.0% | 3 |
| 0-2 events | 6 | 37 | 100.0% | 2 |
| 3-5 events | 23 | 144 | 100.0% | 12 |
| 6-8 events | 23 | 298 | 100.0% | 14 |
| 9+ events | 8 | 134 | 100.0% | 4 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 32 | plant-no-switch-note-g2-s1-0001 |

## rules-g2-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| a /fork session | 7 | 7 | 71.4% | 27.5% | 7 |
| after /branch | 12 | 11 | 100.0% | 28.2% | 12 |
| after /clear | 11 | 9 | 100.0% | 24.3% | 11 |
| after /compact | 7 | 5 | 100.0% | 31.4% | 7 |
| after /fork | 2 | 1 | 100.0% | 39.2% | 2 |
| after /model | 34 | 27 | 66.7% | 26.5% | 34 |
| after /resume in the session | 4 | 3 | 100.0% | 30.5% | 4 |
| after a forking resume with --model | 2 | 1 | 100.0% | 34.2% | 2 |
| after a resume | 3 | 2 | 100.0% | 35.5% | 3 |
| after an edit of tracked code | 89 | 89 | 93.3% | 33.1% | 89 |
| after another edit | 42 | 33 | 81.8% | 26.2% | 42 |
| after leaving plan mode | 17 | 14 | 78.6% | 32.8% | 17 |
| after starting subagents that edit | 55 | 48 | 81.3% | 26.1% | 55 |
| after starting subagents | 228 | 182 | 85.2% | 25.4% | 228 |
| in plan mode | 16 | 11 | 72.7% | 35.0% | 16 |
| start | 11 | 7 | 42.9% | 23.2% | 11 |
| subagent | 183 | 128 | 46.9% | 27.7% | 82 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 14 | 123 | 82.9% | 14 |
| two quiet steps in a row | 46 | 455 | 74.5% | 46 |
| claude | 60 | 578 | 76.3% | 60 |
| 0-2 events | 6 | 32 | 90.6% | 6 |
| 3-5 events | 23 | 135 | 71.1% | 23 |
| 6-8 events | 23 | 286 | 76.6% | 23 |
| 9+ events | 8 | 125 | 77.6% | 8 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 60 | rules-g2-s1-0000 |
| foreign-unretired/subagent | 31 | rules-g2-s1-0000 |
| missing-own/main | 19 | rules-g2-s1-0005 |
| missing-own/subagent | 25 | rules-g2-s1-0000 |

## skills-g2-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| a /fork session | 7 | 7 | 0.0% | no rule text | 0 |
| after /branch | 12 | 11 | 0.0% | no rule text | 0 |
| after /clear | 11 | 9 | 0.0% | no rule text | 0 |
| after /compact | 7 | 5 | 0.0% | no rule text | 0 |
| after /fork | 2 | 1 | 0.0% | no rule text | 0 |
| after /model | 34 | 27 | 0.0% | no rule text | 0 |
| after /resume in the session | 4 | 3 | 0.0% | no rule text | 0 |
| after a forking resume with --model | 2 | 1 | 0.0% | no rule text | 0 |
| after a resume | 3 | 2 | 0.0% | no rule text | 0 |
| after an edit of tracked code | 89 | 89 | 0.0% | no rule text | 0 |
| after another edit | 42 | 33 | 0.0% | no rule text | 0 |
| after leaving plan mode | 17 | 14 | 0.0% | no rule text | 0 |
| after starting subagents that edit | 54 | 47 | 0.0% | no rule text | 0 |
| after starting subagents | 229 | 184 | 0.0% | no rule text | 0 |
| in plan mode | 16 | 11 | 0.0% | no rule text | 0 |
| start | 11 | 7 | 0.0% | no rule text | 0 |
| subagent | 183 | 128 | 0.0% | no rule text | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 14 | 123 | 0.0% | 13 |
| two quiet steps in a row | 46 | 456 | 0.0% | 42 |
| claude | 60 | 579 | 0.0% | 55 |
| 0-2 events | 6 | 31 | 0.0% | 5 |
| 3-5 events | 23 | 136 | 0.0% | 20 |
| 6-8 events | 23 | 288 | 0.0% | 22 |
| 9+ events | 8 | 124 | 0.0% | 8 |

| Violation | Sessions | Example |
| --- | --- | --- |
| missing-own/main | 51 | skills-g2-s1-0000 |
| missing-own/subagent | 31 | skills-g2-s1-0000 |
