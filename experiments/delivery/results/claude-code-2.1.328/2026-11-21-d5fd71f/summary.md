# Delivery benchmark: measures

| | claudemd-s1-n60 | on-s1-n300 | plant-compact-as-resume-s1-n60 | plant-no-switch-note-s1-n60 | rules-s1-n60 | skills-s1-n60 |
| --- | --- | --- | --- | --- | --- | --- |
| Arm | `claudemd` | `on` | `on` (planted: compact-as-resume) | `on` (planted: no-switch-note) | `rules` | `skills` |
| Sessions measured / run | 60 / 60 | 300 / 300 | 60 / 60 | 60 / 60 | 60 / 60 | 60 / 60 |
| Requests (main, subagent, compaction) | 862 (649, 184, 29) | 4381 (3279, 934, 168) | 869 (656, 184, 29) | 867 (654, 184, 29) | 864 (651, 184, 29) | 872 (659, 184, 29) |
| Coverage | 87.3% (565 of 647) | 99.9% (3219 of 3221) | 94.7% (619 of 654) | 100.0% (651 of 651) | 70.6% (459 of 650) | 0.0% (0 of 654) |
| Coverage, subagents | 32.2% (39 of 121) | 100.0% (668 of 668) | 100.0% (121 of 121) | 100.0% (121 of 121) | 32.2% (39 of 121) | 0.0% (0 of 121) |
| Coverage, by rule | 90.2% | 100.0% | 94.9% | 100.0% | 77.3% | 0.0% |
| Own share | 31.5% | 79.0% | 80.3% | 79.2% | 27.0% | no rule text |
| Right share | 12.8% | 51.6% | 51.5% | 54.4% | 11.9% | no rule text |
| Characters added per request | 4415 | 1155 | 1135 | 1128 | 3987 | 0 |
| Share of the request text | 15.3% | 4.7% | 4.6% | 4.6% | 13.9% | 0.0% |
| Requests with a rule of another model and no note | 707 | 2 | 0 | 112 | 709 | 0 |
| Sessions with an unexplained violation | 60 | 1 | 9 | 28 | 60 | 55 |

## claudemd-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| after /clear | 23 | 15 | 100.0% | 30.3% | 23 |
| after /compact | 8 | 5 | 100.0% | 26.6% | 8 |
| after /model | 26 | 23 | 100.0% | 32.3% | 26 |
| after a resume with --model | 8 | 7 | 100.0% | 35.2% | 8 |
| after a resume | 4 | 3 | 100.0% | 35.3% | 4 |
| after an edit of tracked code | 160 | 138 | 100.0% | 32.1% | 160 |
| after another edit | 78 | 69 | 100.0% | 31.9% | 78 |
| after starting subagents | 327 | 256 | 100.0% | 31.2% | 327 |
| start | 15 | 10 | 100.0% | 32.8% | 15 |
| subagent | 184 | 121 | 32.2% | 30.9% | 58 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 28 | 281 | 86.8% | 28 |
| two quiet steps in a row | 32 | 366 | 87.7% | 32 |
| 0-2 events | 6 | 26 | 96.2% | 6 |
| 3-5 events | 26 | 211 | 85.3% | 26 |
| 6-8 events | 19 | 257 | 86.4% | 19 |
| 9+ events | 9 | 153 | 90.2% | 9 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 60 | claudemd-s1-0001 |
| foreign-unretired/subagent | 34 | claudemd-s1-0000 |
| missing-own/subagent | 30 | claudemd-s1-0001 |

## on-s1-n300

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| after /clear | 84 | 61 | 100.0% | 100.0% | 0 |
| after /compact | 66 | 52 | 100.0% | 97.8% | 0 |
| after /model | 144 | 114 | 100.0% | 56.8% | 0 |
| after a resume with --model | 38 | 25 | 100.0% | 44.6% | 0 |
| after a resume | 25 | 21 | 90.5% | 69.2% | 2 |
| after an edit of tracked code | 679 | 559 | 100.0% | 78.8% | 0 |
| after another edit | 420 | 327 | 100.0% | 74.8% | 0 |
| after starting subagents | 1724 | 1316 | 100.0% | 78.4% | 0 |
| start | 99 | 78 | 100.0% | 100.0% | 0 |
| subagent | 934 | 668 | 100.0% | 100.0% | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 124 | 1326 | 100.0% | 0 |
| two quiet steps in a row | 176 | 1895 | 99.9% | 1 |
| 0-2 events | 28 | 128 | 100.0% | 0 |
| 3-5 events | 106 | 795 | 99.8% | 1 |
| 6-8 events | 121 | 1542 | 100.0% | 0 |
| 9+ events | 45 | 756 | 100.0% | 0 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 1 | on-s1-0096 |
| missing-own/main | 1 | on-s1-0096 |

## plant-compact-as-resume-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| after /clear | 23 | 15 | 100.0% | 100.0% | 0 |
| after /compact | 8 | 5 | 60.0% | 100.0% | 0 |
| after /model | 26 | 23 | 100.0% | 62.4% | 0 |
| after a resume with --model | 8 | 7 | 100.0% | 70.2% | 0 |
| after a resume | 4 | 3 | 33.3% | 53.6% | 0 |
| after an edit of tracked code | 160 | 138 | 87.7% | 83.9% | 0 |
| after another edit | 78 | 69 | 92.8% | 68.5% | 0 |
| after starting subagents | 334 | 263 | 96.6% | 80.0% | 0 |
| start | 15 | 10 | 100.0% | 100.0% | 0 |
| subagent | 184 | 121 | 100.0% | 100.0% | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 28 | 284 | 96.1% | 3 |
| two quiet steps in a row | 32 | 370 | 93.5% | 6 |
| 0-2 events | 6 | 26 | 100.0% | 0 |
| 3-5 events | 26 | 216 | 98.6% | 1 |
| 6-8 events | 19 | 257 | 93.8% | 4 |
| 9+ events | 9 | 155 | 89.7% | 4 |

| Violation | Sessions | Example |
| --- | --- | --- |
| missing-own/main | 9 | plant-compact-as-resume-s1-0008 |

## plant-no-switch-note-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| after /clear | 23 | 15 | 100.0% | 100.0% | 0 |
| after /compact | 8 | 5 | 100.0% | 100.0% | 0 |
| after /model | 26 | 23 | 100.0% | 60.1% | 21 |
| after a resume with --model | 8 | 7 | 100.0% | 60.7% | 0 |
| after a resume | 4 | 3 | 100.0% | 74.6% | 0 |
| after an edit of tracked code | 160 | 138 | 100.0% | 83.8% | 25 |
| after another edit | 78 | 69 | 100.0% | 65.5% | 30 |
| after starting subagents | 332 | 260 | 100.0% | 79.5% | 36 |
| start | 15 | 10 | 100.0% | 100.0% | 0 |
| subagent | 184 | 121 | 100.0% | 100.0% | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 28 | 283 | 100.0% | 7 |
| two quiet steps in a row | 32 | 368 | 100.0% | 21 |
| 0-2 events | 6 | 26 | 100.0% | 0 |
| 3-5 events | 26 | 214 | 100.0% | 14 |
| 6-8 events | 19 | 256 | 100.0% | 8 |
| 9+ events | 9 | 155 | 100.0% | 6 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 28 | plant-no-switch-note-s1-0001 |

## rules-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| after /clear | 23 | 15 | 80.0% | 25.4% | 23 |
| after /compact | 8 | 5 | 80.0% | 23.7% | 8 |
| after /model | 26 | 23 | 87.0% | 30.0% | 26 |
| after a resume with --model | 8 | 7 | 71.4% | 25.8% | 8 |
| after a resume | 4 | 3 | 66.7% | 23.2% | 4 |
| after an edit of tracked code | 160 | 138 | 94.2% | 29.3% | 160 |
| after another edit | 78 | 69 | 82.6% | 26.2% | 78 |
| after starting subagents | 329 | 259 | 71.8% | 26.5% | 329 |
| start | 15 | 10 | 40.0% | 22.7% | 15 |
| subagent | 184 | 121 | 32.2% | 24.4% | 58 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 28 | 284 | 69.7% | 28 |
| two quiet steps in a row | 32 | 366 | 71.3% | 32 |
| 0-2 events | 6 | 26 | 88.5% | 6 |
| 3-5 events | 26 | 212 | 59.4% | 26 |
| 6-8 events | 19 | 256 | 74.6% | 19 |
| 9+ events | 9 | 156 | 76.3% | 9 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 60 | rules-s1-0001 |
| foreign-unretired/subagent | 34 | rules-s1-0000 |
| missing-own/main | 18 | rules-s1-0005 |
| missing-own/subagent | 30 | rules-s1-0001 |

## skills-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| after /clear | 23 | 15 | 0.0% | no rule text | 0 |
| after /compact | 8 | 5 | 0.0% | no rule text | 0 |
| after /model | 26 | 23 | 0.0% | no rule text | 0 |
| after a resume with --model | 8 | 7 | 0.0% | no rule text | 0 |
| after a resume | 4 | 3 | 0.0% | no rule text | 0 |
| after an edit of tracked code | 160 | 138 | 0.0% | no rule text | 0 |
| after another edit | 78 | 69 | 0.0% | no rule text | 0 |
| after starting subagents | 337 | 263 | 0.0% | no rule text | 0 |
| start | 15 | 10 | 0.0% | no rule text | 0 |
| subagent | 184 | 121 | 0.0% | no rule text | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 28 | 283 | 0.0% | 25 |
| two quiet steps in a row | 32 | 371 | 0.0% | 30 |
| 0-2 events | 6 | 26 | 0.0% | 5 |
| 3-5 events | 26 | 212 | 0.0% | 23 |
| 6-8 events | 19 | 258 | 0.0% | 18 |
| 9+ events | 9 | 158 | 0.0% | 9 |

| Violation | Sessions | Example |
| --- | --- | --- |
| missing-own/main | 53 | skills-s1-0001 |
| missing-own/subagent | 38 | skills-s1-0001 |
