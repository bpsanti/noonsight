# Delivery benchmark: measures

| | claudemd-s1-n60 | on-s1-n300 | plant-compact-as-resume-s1-n60 | plant-no-switch-note-s1-n60 | rules-s1-n60 | skills-s1-n60 |
| --- | --- | --- | --- | --- | --- | --- |
| Arm | `claudemd` | `on` | `on` (planted: compact-as-resume) | `on` (planted: no-switch-note) | `rules` | `skills` |
| Sessions measured / run | 60 / 60 | 296 / 300 | 60 / 60 | 60 / 60 | 60 / 60 | 60 / 60 |
| Requests (main, subagent, compaction) | 851 (638, 184, 29) | 4202 (3121, 916, 165) | 853 (640, 184, 29) | 856 (643, 184, 29) | 845 (633, 183, 29) | 855 (642, 184, 29) |
| Coverage | 87.2% (557 of 639) | 99.4% (3071 of 3090) | 91.3% (587 of 643) | 99.8% (642 of 643) | 70.6% (448 of 635) | 0.0% (0 of 643) |
| Coverage, subagents | 32.2% (39 of 121) | 99.7% (653 of 655) | 100.0% (121 of 121) | 100.0% (121 of 121) | 32.5% (39 of 120) | 0.0% (0 of 121) |
| Coverage, by rule | 90.0% | 99.7% | 91.7% | 99.9% | 77.3% | 0.0% |
| Own share | 31.6% | 78.4% | 79.9% | 78.8% | 27.4% | no rule text |
| Right share | 12.8% | 52.5% | 52.5% | 55.3% | 11.9% | no rule text |
| Characters added per request | 4405 | 1132 | 1067 | 1113 | 3972 | 0 |
| Share of the request text | 15.3% | 4.7% | 4.4% | 4.5% | 13.9% | 0.0% |
| Requests with a rule of another model and no note | 696 | 80 | 11 | 118 | 691 | 0 |
| Sessions with an unexplained violation | 60 | 26 | 13 | 29 | 60 | 55 |

## claudemd-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| after /clear | 24 | 16 | 100.0% | 29.8% | 24 |
| after /compact | 8 | 5 | 100.0% | 26.6% | 8 |
| after /model | 26 | 23 | 100.0% | 32.3% | 26 |
| after a resume with --model | 8 | 7 | 100.0% | 35.2% | 8 |
| after a resume | 4 | 3 | 100.0% | 35.3% | 4 |
| after an edit of tracked code | 160 | 138 | 100.0% | 32.1% | 160 |
| after another edit | 78 | 69 | 100.0% | 31.9% | 78 |
| after starting subagents | 315 | 247 | 100.0% | 31.3% | 315 |
| start | 15 | 10 | 100.0% | 32.8% | 15 |
| subagent | 184 | 121 | 32.2% | 30.9% | 58 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 28 | 279 | 86.7% | 28 |
| two quiet steps in a row | 32 | 360 | 87.5% | 32 |
| 0-2 events | 6 | 27 | 96.3% | 6 |
| 3-5 events | 26 | 211 | 85.3% | 26 |
| 6-8 events | 19 | 250 | 86.0% | 19 |
| 9+ events | 9 | 151 | 90.1% | 9 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 60 | claudemd-s1-0001 |
| foreign-unretired/subagent | 34 | claudemd-s1-0000 |
| missing-own/subagent | 30 | claudemd-s1-0001 |

## on-s1-n300

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| after /clear | 84 | 61 | 98.4% | 98.7% | 1 |
| after /compact | 67 | 52 | 98.1% | 97.7% | 1 |
| after /model | 143 | 114 | 100.0% | 56.2% | 12 |
| after a resume with --model | 39 | 25 | 92.0% | 42.1% | 4 |
| after a resume | 28 | 24 | 91.7% | 63.1% | 2 |
| after an edit of tracked code | 666 | 545 | 99.5% | 78.0% | 13 |
| after another edit | 404 | 316 | 98.7% | 74.1% | 14 |
| after starting subagents | 1592 | 1221 | 99.7% | 77.8% | 29 |
| start | 98 | 77 | 100.0% | 100.0% | 0 |
| subagent | 916 | 655 | 99.7% | 99.3% | 4 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 122 | 1285 | 100.0% | 0 |
| two quiet steps in a row | 174 | 1805 | 98.9% | 26 |
| 0-2 events | 28 | 128 | 100.0% | 0 |
| 3-5 events | 104 | 766 | 99.6% | 7 |
| 6-8 events | 121 | 1498 | 99.5% | 13 |
| 9+ events | 43 | 698 | 98.7% | 6 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 24 | on-s1-0030 |
| foreign-unretired/subagent | 3 | on-s1-0045 |
| missing-own/main | 5 | on-s1-0045 |
| missing-own/subagent | 1 | on-s1-0174 |
| own-retired/main | 2 | on-s1-0099 |

## plant-compact-as-resume-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| after /clear | 23 | 15 | 93.3% | 94.2% | 1 |
| after /compact | 8 | 5 | 20.0% | 100.0% | 0 |
| after /model | 26 | 23 | 100.0% | 62.5% | 2 |
| after a resume with --model | 8 | 7 | 100.0% | 70.2% | 0 |
| after a resume | 4 | 3 | 33.3% | 53.6% | 0 |
| after an edit of tracked code | 160 | 138 | 79.7% | 84.6% | 3 |
| after another edit | 78 | 69 | 89.9% | 68.2% | 0 |
| after starting subagents | 318 | 252 | 94.4% | 79.1% | 4 |
| start | 15 | 10 | 100.0% | 100.0% | 0 |
| subagent | 184 | 121 | 100.0% | 99.0% | 1 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 28 | 280 | 92.5% | 4 |
| two quiet steps in a row | 32 | 363 | 90.4% | 9 |
| 0-2 events | 6 | 26 | 100.0% | 0 |
| 3-5 events | 26 | 211 | 93.8% | 2 |
| 6-8 events | 19 | 254 | 91.3% | 5 |
| 9+ events | 9 | 152 | 86.2% | 6 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 4 | plant-compact-as-resume-s1-0030 |
| foreign-unretired/subagent | 1 | plant-compact-as-resume-s1-0045 |
| missing-own/main | 12 | plant-compact-as-resume-s1-0008 |

## plant-no-switch-note-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| after /clear | 23 | 15 | 93.3% | 94.2% | 1 |
| after /compact | 8 | 5 | 100.0% | 100.0% | 0 |
| after /model | 26 | 23 | 100.0% | 58.9% | 21 |
| after a resume with --model | 8 | 7 | 100.0% | 60.7% | 0 |
| after a resume | 4 | 3 | 100.0% | 74.6% | 0 |
| after an edit of tracked code | 160 | 138 | 100.0% | 83.8% | 25 |
| after another edit | 78 | 69 | 100.0% | 65.5% | 30 |
| after starting subagents | 321 | 252 | 100.0% | 79.0% | 40 |
| start | 15 | 10 | 100.0% | 100.0% | 0 |
| subagent | 184 | 121 | 100.0% | 99.0% | 1 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 28 | 282 | 100.0% | 7 |
| two quiet steps in a row | 32 | 361 | 99.7% | 22 |
| 0-2 events | 6 | 27 | 100.0% | 0 |
| 3-5 events | 26 | 212 | 100.0% | 14 |
| 6-8 events | 19 | 252 | 99.6% | 9 |
| 9+ events | 9 | 152 | 100.0% | 6 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 29 | plant-no-switch-note-s1-0001 |
| foreign-unretired/subagent | 1 | plant-no-switch-note-s1-0045 |
| missing-own/main | 1 | plant-no-switch-note-s1-0045 |

## rules-s1-n60

| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |
| --- | --- | --- | --- | --- | --- |
| after /clear | 23 | 15 | 80.0% | 25.4% | 23 |
| after /compact | 8 | 5 | 80.0% | 24.8% | 8 |
| after /model | 26 | 23 | 87.0% | 30.7% | 26 |
| after a resume with --model | 8 | 7 | 71.4% | 25.8% | 8 |
| after a resume | 4 | 3 | 66.7% | 26.0% | 4 |
| after an edit of tracked code | 160 | 138 | 94.2% | 29.9% | 160 |
| after another edit | 76 | 67 | 82.1% | 26.4% | 76 |
| after starting subagents | 313 | 247 | 71.7% | 26.7% | 313 |
| start | 15 | 10 | 40.0% | 22.7% | 15 |
| subagent | 183 | 120 | 32.5% | 24.4% | 58 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 28 | 274 | 69.3% | 28 |
| two quiet steps in a row | 32 | 361 | 71.5% | 32 |
| 0-2 events | 6 | 26 | 88.5% | 6 |
| 3-5 events | 26 | 205 | 58.0% | 26 |
| 6-8 events | 19 | 252 | 74.6% | 19 |
| 9+ events | 9 | 152 | 77.6% | 9 |

| Violation | Sessions | Example |
| --- | --- | --- |
| foreign-unretired/main | 60 | rules-s1-0001 |
| foreign-unretired/subagent | 34 | rules-s1-0000 |
| missing-own/main | 18 | rules-s1-0005 |
| missing-own/subagent | 29 | rules-s1-0001 |

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
| after starting subagents | 320 | 252 | 0.0% | no rule text | 0 |
| start | 15 | 10 | 0.0% | no rule text | 0 |
| subagent | 184 | 121 | 0.0% | no rule text | 0 |

| Sessions | Count | Rules due | Coverage | With an unexplained violation |
| --- | --- | --- | --- | --- |
| every quiet step followed by a request | 28 | 282 | 0.0% | 25 |
| two quiet steps in a row | 32 | 361 | 0.0% | 30 |
| 0-2 events | 6 | 27 | 0.0% | 5 |
| 3-5 events | 26 | 208 | 0.0% | 23 |
| 6-8 events | 19 | 256 | 0.0% | 18 |
| 9+ events | 9 | 152 | 0.0% | 9 |

| Violation | Sessions | Example |
| --- | --- | --- |
| missing-own/main | 53 | skills-s1-0001 |
| missing-own/subagent | 38 | skills-s1-0001 |
