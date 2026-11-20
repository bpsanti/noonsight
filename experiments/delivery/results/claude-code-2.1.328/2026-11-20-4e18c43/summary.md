# Delivery benchmark: measures

| | claudemd-s1-n60 | on-s1-n300 | plant-compact-as-resume-s1-n60 | plant-no-switch-note-s1-n60 | rules-s1-n60 | skills-s1-n60 |
| --- | --- | --- | --- | --- | --- | --- |
| Arm | `claudemd` | `on` | `on` (planted: compact-as-resume) | `on` (planted: no-switch-note) | `rules` | `skills` |
| Sessions measured / run | 60 / 60 | 300 / 300 | 60 / 60 | 60 / 60 | 60 / 60 | 60 / 60 |
| Requests (main, subagent, compaction) | 861 (648, 184, 29) | 4376 (3274, 934, 168) | 862 (649, 184, 29) | 871 (658, 184, 29) | 864 (651, 184, 29) | 866 (653, 184, 29) |
| Coverage | 87.4% (566 of 648) | 99.5% (3199 of 3216) | 94.4% (611 of 647) | 100.0% (654 of 654) | 70.9% (460 of 649) | 0.0% (0 of 650) |
| Coverage, subagents | 32.2% (39 of 121) | 99.9% (667 of 668) | 100.0% (121 of 121) | 100.0% (121 of 121) | 32.2% (39 of 121) | 0.0% (0 of 121) |
| Coverage, by rule | 90.2% | 99.6% | 94.6% | 100.0% | 77.5% | 0.0% |
| Own share | 31.6% | 78.8% | 80.7% | 79.0% | 27.1% | no rule text |
| Right share | 12.8% | 51.4% | 51.9% | 54.0% | 11.9% | no rule text |
| Characters added per request | 4414 | 1154 | 1115 | 1137 | 3995 | 0 |
| Share of the request text | 15.3% | 4.7% | 4.5% | 4.6% | 14.0% | 0.0% |
| Requests with a rule of another model and no note | 706 | 22 | 0 | 113 | 709 | 0 |
| Sessions with an unexplained violation | 60 | 3 | 10 | 28 | 60 | 55 |

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
| after starting subagents | 326 | 257 | 100.0% | 31.3% | 326 |
| start | 15 | 10 | 100.0% | 32.8% | 15 |
| subagent | 184 | 121 | 32.2% | 30.9% | 58 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 28 | 283 | 86.9% | 28 |
| two quiet steps in a row | 32 | 365 | 87.7% | 32 |
| 0-2 events | 6 | 26 | 96.2% | 6 |
| 3-5 events | 26 | 211 | 85.3% | 26 |
| 6-8 events | 19 | 256 | 86.3% | 19 |
| 9+ events | 9 | 155 | 90.3% | 9 |

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
| after a resume with --model | 38 | 25 | 100.0% | 44.6% | 1 |
| after a resume | 25 | 21 | 90.5% | 69.2% | 2 |
| after an edit of tracked code | 679 | 559 | 98.8% | 78.4% | 7 |
| after another edit | 420 | 327 | 100.0% | 74.8% | 0 |
| after starting subagents | 1719 | 1311 | 99.5% | 78.1% | 11 |
| start | 99 | 78 | 100.0% | 100.0% | 0 |
| subagent | 934 | 668 | 99.9% | 99.9% | 1 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 124 | 1323 | 100.0% | 0 |
| two quiet steps in a row | 176 | 1893 | 99.1% | 3 |
| 0-2 events | 28 | 131 | 100.0% | 0 |
| 3-5 events | 106 | 791 | 99.8% | 1 |
| 6-8 events | 121 | 1538 | 99.0% | 1 |
| 9+ events | 45 | 756 | 100.0% | 1 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 3 | on-s1-0096 |
| foreign-unretired/subagent | 1 | on-s1-0230 |
| missing-own/main | 2 | on-s1-0096 |
| missing-own/subagent | 1 | on-s1-0230 |

## plant-compact-as-resume-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| after /clear | 23 | 15 | 100.0% | 100.0% | 0 |
| after /compact | 8 | 5 | 40.0% | 100.0% | 0 |
| after /model | 26 | 23 | 100.0% | 63.7% | 0 |
| after a resume with --model | 8 | 7 | 100.0% | 70.2% | 0 |
| after a resume | 4 | 3 | 33.3% | 53.6% | 0 |
| after an edit of tracked code | 160 | 138 | 87.7% | 85.6% | 0 |
| after another edit | 78 | 69 | 92.8% | 68.5% | 0 |
| after starting subagents | 327 | 256 | 96.5% | 80.1% | 0 |
| start | 15 | 10 | 100.0% | 100.0% | 0 |
| subagent | 184 | 121 | 100.0% | 100.0% | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 28 | 283 | 96.1% | 3 |
| two quiet steps in a row | 32 | 364 | 93.1% | 7 |
| 0-2 events | 6 | 27 | 100.0% | 0 |
| 3-5 events | 26 | 212 | 98.6% | 1 |
| 6-8 events | 19 | 255 | 93.7% | 4 |
| 9+ events | 9 | 153 | 88.9% | 5 |

| Violation | Sessions | Example |
| --- | --- | --- |
| missing-own/main | 10 | plant-compact-as-resume-s1-0008 |

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
| after starting subagents | 336 | 263 | 100.0% | 79.1% | 37 |
| start | 15 | 10 | 100.0% | 100.0% | 0 |
| subagent | 184 | 121 | 100.0% | 100.0% | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 28 | 282 | 100.0% | 7 |
| two quiet steps in a row | 32 | 372 | 100.0% | 21 |
| 0-2 events | 6 | 26 | 100.0% | 0 |
| 3-5 events | 26 | 213 | 100.0% | 14 |
| 6-8 events | 19 | 259 | 100.0% | 8 |
| 9+ events | 9 | 156 | 100.0% | 6 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 28 | plant-no-switch-note-s1-0001 |

## rules-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| after /clear | 23 | 15 | 80.0% | 25.4% | 23 |
| after /compact | 8 | 5 | 80.0% | 28.8% | 8 |
| after /model | 26 | 23 | 87.0% | 29.0% | 26 |
| after a resume with --model | 8 | 7 | 71.4% | 25.8% | 8 |
| after a resume | 4 | 3 | 66.7% | 25.9% | 4 |
| after an edit of tracked code | 160 | 138 | 94.2% | 29.9% | 160 |
| after another edit | 78 | 69 | 82.6% | 26.2% | 78 |
| after starting subagents | 329 | 258 | 72.5% | 26.2% | 329 |
| start | 15 | 10 | 40.0% | 22.7% | 15 |
| subagent | 184 | 121 | 32.2% | 24.4% | 58 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 28 | 285 | 70.2% | 28 |
| two quiet steps in a row | 32 | 364 | 71.4% | 32 |
| 0-2 events | 6 | 27 | 88.9% | 6 |
| 3-5 events | 26 | 212 | 59.0% | 26 |
| 6-8 events | 19 | 255 | 75.3% | 19 |
| 9+ events | 9 | 155 | 76.8% | 9 |

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
| after starting subagents | 331 | 259 | 0.0% | no rule text | 0 |
| start | 15 | 10 | 0.0% | no rule text | 0 |
| subagent | 184 | 121 | 0.0% | no rule text | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 28 | 283 | 0.0% | 25 |
| two quiet steps in a row | 32 | 367 | 0.0% | 30 |
| 0-2 events | 6 | 26 | 0.0% | 5 |
| 3-5 events | 26 | 212 | 0.0% | 23 |
| 6-8 events | 19 | 257 | 0.0% | 18 |
| 9+ events | 9 | 155 | 0.0% | 9 |

| Violation | Sessions | Example |
| --- | --- | --- |
| missing-own/main | 53 | skills-s1-0001 |
| missing-own/subagent | 38 | skills-s1-0001 |
