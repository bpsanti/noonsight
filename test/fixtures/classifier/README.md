# Hand-labeled tasks for the classifier

`tasks.json` holds 45 task texts, each labeled by hand with one scope of the `claude` preset (`investigate`, `build`, `review`, `routine`, `digest`) or with `none`.
The live test `classifier-agreement` (`test/live/classifier.test.ts`) asks the classifier to place each one with the preset's scope descriptions, and reports how often it agrees with the label.

The texts are generic: no company, product or person is named, and none comes from a real conversation.
They are written the way a person or a session writes a task for an agent, in one to three sentences.

## How a task was labeled

Each label follows the rule below, applied in order, so that someone else can relabel the file and compare.
The scope descriptions are the ones in `presets/claude/preset.json`.

1. **Label the work the task asks for, not the subject it mentions.**
   "Summarize why the export fails, then fix it" asks for a fix, not a summary.
2. **The deliverable decides.**
   Ask what the task hands back when it is done: a change to code, configuration or documents; an explanation or a decision; a judgment of existing work; or information that already exists, found or condensed.
3. **A change to code, configuration or documents is `routine` or `build`.**
   It is `routine` when the task text states exactly what to change, so that doing it needs no decision: a rename, a version bump, a setting, a documented flag, a typo, a changelog entry, removing code behind a flag that is off everywhere.
   It is `build` when the agent has to work out how: the cause of the defect is not given ("find out why and fix it" is `build`, since the deliverable is the fix), the contract changes across several parts, the refactor or the migration needs a design, or a guarantee such as safety under concurrency must be designed in.
4. **An explanation or a decision is `investigate`.**
   The task asks for a root cause, a diagnosis, a comparison that ends in a recommendation, or a design proposal, and says or implies that no change is made yet.
5. **A judgment of existing work is `review`.**
   The task points at a result that is already there (a pull request, a diff, a commit, a script, a design document, a test suite) and asks for findings, gaps or approval, not for a change.
6. **Information that already exists, found or condensed, is `digest`.**
   A summary, a digest, a table built from documents, a list of places in the code, an extraction from a specification, a grouping of issues, or a question answered by reading the code.
   Nothing is diagnosed or judged.
7. **A request that is not software work is `none`.**
   A thank-you, a general knowledge question, creative writing with no relation to a codebase.

When two rules seem to fit, the earlier one in this list decides.
