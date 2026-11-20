# Adoption evaluation, 2026-11-20, pilot (v1 reference)

The pilot of the pre-registered design: the judge's calibration on six answers, then one session per model and condition, eight in all, judged with the first version of the reference.
Commits `f061f03` (`before`) and `d956687` (`after`), Claude Code 2.1.330, OAuth token of the account that paid, at most two sessions at once.

- `calibration.json`: the judge (Claude Opus 5.5, `medium`) agreed with the expected `grounded` on all six answers, for $0.69.
- `runs.jsonl`, `answers/`: the eight sessions, $5.65; seven verdicts `adopt with conditions` and one `do not adopt` (Haiku 5.5, `before`).
- `judgments.jsonl`, `summary.md`: none of the eight judged grounded, for $1.48 of judgments.
- `npm run adoption -- estimate` on this folder: Fable 5.2 at $1.875 a session, Opus 5.5 $0.697, Sonnet 5.5 $0.239, Haiku 5.5 $0.013, the judge $0.185 an answer; allocation five sessions per model and condition without Fable, projected $19.49 against the $20 cap.

Read with the judgments, most failures were the reference's: real features its summary list did not hold, counted as invented, and numbers from committed results that the evidence map does not give, counted as false.
The pre-registration's section "Revision after the pilot (v2)" says what changed and why; this folder is kept as the pilot ran.
