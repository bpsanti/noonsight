# Adoption evaluation, 2026-11-20, v2

The design of the pre-registration, with the revision its section "Revision after the pilot (v2)" made before this run: commits `f061f03` (`before`) and `c6a919c` (`after`), Claude Opus 5.5, Sonnet 5.5 and Haiku 5.5 at `medium` effort, three sessions per model and condition, Claude Code 2.1.330, at most two sessions at once.
The three `before` sessions numbered 1 are the pilot's (`results/2026-11-20-pilot-v1`).

## Result

**The rewritten README does not pass the pre-registered bar.**
2 of the 9 `after` answers were grounded (Sonnet 2 of 3, Opus 0 of 3, Haiku 0 of 3), against 0 of 9 `before`; Fisher's exact test, two-sided, p 0.47 ([summary.md](summary.md)).

Every answer, in both conditions, stated the delivery claim correctly, named at least one real limit, and, but one `before` answer, invented no feature.
All 18 recommended adopting with conditions, but two `before` answers that recommended not adopting.
What failed was the reasons: in 7 of the 9 `after` answers, the judge found a number credited to the wrong arm of the rule effect experiment, which the v2 reference counts as false:

- six credited the 30 of 30 runs of Sonnet's preset rules to `verify-changes` alone (29 of 30), gave Haiku 30 of 30 or 29 of 30 where it had 27 of 30, or attached the cost of `verify-changes` alone ($0.0505) to the preset's runs ($0.0378), all read from the README's section "What the rules change", which put the preset's arm and the single-rule arms side by side;
- one read the README's table as a `CLAUDE.md` failing after `/model`, `/compact` and resumes, where every one of its misses was a subagent.

## What changed after it

The README's section "What the rules change" now gives one arm, `verify-changes` delivered alone, with its tests and its cost, and the README says that a `CLAUDE.md` reached every request of the main conversation and missed only subagents.
That version was not evaluated: a third run, nine `after` sessions and their judgments, projects about $4.60, and $3.49 of the $20 cap remained.

## Cost

Sessions $4.50 (the three reused `before` sessions are counted with the pilot), calibration $1.00, judgments $3.19.
With the pilot ($7.82), the evaluation spent $16.51 of its $20 cap.
