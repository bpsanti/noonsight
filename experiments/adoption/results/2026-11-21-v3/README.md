# Adoption evaluation, 2026-11-21, v3

The v2 design unchanged (prompt, sandbox, reference, judge, scoring and pass bar), run once more on the final README, `6aa90d9`, which separates the arms of the rule effect experiment and says what a `CLAUDE.md` missed.
The 9 `before` answers and their judgments are v2's, since `before` (`f061f03`), the reference and the judge did not change; only the 9 `after` sessions ran: Claude Opus 5.5, Sonnet 5.5 and Haiku 5.5 at `medium` effort, three each, Claude Code 2.1.330, at most two at once.
The judge was not calibrated again: its instructions and reference are those that passed v2's nine-answer calibration.

## Result

**The README does not pass the pre-registered bar, though it comes closer.**
6 of 9 `after` answers were grounded (Opus 2 of 3, Sonnet 3 of 3, Haiku 1 of 3), against 0 of 9 `before`; Fisher's exact test, two-sided, p 0.009 ([summary.md](summary.md)).
The bar asks 80% overall and 60% for each model; Haiku's 1 of 3 and the overall 67% miss it, and the third condition, no worse than `before`, is met.
All 9 answers recommended adopting with conditions, stated the delivery claim correctly, named a real limit and invented no feature.

The three that were not grounded:

- `after-haiku-1` credited the preset's 30 of 30 to `verify-changes` alone, from `docs/sources.md`, which gave the two arms in one sentence.
- `after-haiku-2` said the reproductions of F3 and F4 pass in the corpus, which the README's "must pass" invited although the committed corpus run predates those fixes, and that Fable 5.2's rules were never measured, which R9 contradicts.
- `after-opus-3` was judged against the reference's limit L4, "a watched session with no task scope receives nothing from the shipped preset", for saying such a session gets `verify-changes` after its first code edit; that answer is right (`docs/configuration.md`, "The preset"), and L4, like the README sentence it was taken from, was wrong. Scored with a correct L4, the run would have 7 of 9 grounded, still short of 80%.

## After it

The README's sentence on a session with no scope now names the `code-edit` trigger, its sentence on the corpus says the corpus has no committed run on the fixed build, and `docs/sources.md` and `docs/usage.md` follow; the reference's L4 is left as pre-registered, and its error is recorded here.
None of this was evaluated again.

## Fable 5.2

Asked after this run: three Fable 5.2 sessions per condition with the same prompt, reference and judge.
At the pilot's measured $1.876 a session and v3's $0.167 a judgment, five new sessions (the pilot's `before` session counts) and six judgments project $10.38, a total of $31.14 against a cap of $25, so they did not run.

## Cost

Sessions $2.75 and judgments $1.50 new in this run; the evaluation's total is $20.76.
