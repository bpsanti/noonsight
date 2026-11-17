# Digest rubrics

One file per digest task, `<instance id>.json`, written by the author from the issue thread alone (the `problem_statement` and `hints_text` of the SWE-bench Verified instance), before any digest run:

```json
{
  "instance": "<instance id>",
  "written": "<date>",
  "key_points": [
    "The problem: ...",
    "A proposal made in the discussion: ...",
    "What was agreed: ...",
    "What is still open: ..."
  ]
}
```

Each key point is one statement a good summary makes; the judge marks each as covered or not, and the score is the share covered.
Write 5 to 8 points, each checkable on its own, and do not read any model's summary first.
The judge refuses a file with fewer than 5 points, so a digest answer stays ungraded until its rubric is committed.
