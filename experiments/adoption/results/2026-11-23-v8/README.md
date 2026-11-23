# Adoption evaluation, 2026-11-23, v8: stopped at the calibration

The design pre-registered in [the v8 section](../../README.md#v8-one-current-value-per-fact) of the evaluation's README, with `after` at `e8a3c60`.
The judge reached the expected `grounded` on 8 of the 9 calibration answers ([calibration.json](calibration.json)), so v8 stopped as its plan says.
No session ran and no real answer was judged; the calibration cost $1.60.

The judge disagreed on `unlisted-real-details`, expected grounded: it judged false the sentence "In its benchmark pilot, the decision log matched what the stand-in API saw on most sessions".
The comparison of the log with the stand-in is the delivery benchmark's (`agree.json` of its runs).
The evidence map of v7 had no entry on the benchmark pilot; that of `e8a3c60` describes it and gives B1 and B2, so the judge could tell that the sentence names the wrong experiment.
The v5 to v7 judges called the same sentence unsupported.
The calibration answer is wrong against the map, and its review before the run, which looked for superseded numbers, did not catch it.
