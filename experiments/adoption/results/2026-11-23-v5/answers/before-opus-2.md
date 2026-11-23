**Verdict: do not adopt for the team yet.** It's a careful piece of work, but it hasn't been released, and the evidence that it improves results is thin. At most, run a small pilot (see below).

**Reasons**

- **It isn't released.** `package.json` says version `0.0.1` with `"private": true`, and the README says "Status: early development. Nothing is published yet." You would install it from a clone with `npm link`. It was also renamed recently (sextant → noonsight) with no automatic migration, and the CHANGELOG has only an "Unreleased" section.
- **By default, most of your sessions would get nothing.** Most preset rules apply only to certain task types, and the preset can't detect the task type on its own. The README says a session with no task type set "gets only the rules its model has for every scope, which with the preset is none." In a normal interactive session, which is most of your use:
  - Opus gets nothing. `unattended-run` applies only to unattended runs, and Opus's other rules are off.
  - Fable gets nothing in the main session. Its rules go only to subagents or unattended runs.
  - Sonnet and Haiku get only `verify-changes`, and only after their first edit of a code file that git already tracks.
  - To get more, everyone would have to set `NOONSIGHT_SCOPE`, launch through `noonsight run --scope`, or turn on the classifier, which sends task text to Haiku.
- **The measured benefit is narrow.**
  - The clearest result is that `verify-changes` made Sonnet and Haiku run tests after a one-file fix: 30/30 and 27/30, against 0/30 without it.
  - `sonnet-5-5/carry-through` helped on one backlog task (32/40 against 9/40).
  - The Haiku carry-through rule showed no effect, and the long-task pilot found nothing for the carry-through rules to change.
  - In the public-task benchmark (`experiments/benchmark/results/2026-11-19/summary.md`), the verifier saw no difference between conditions (133, 132 and 133 of 144 resolved) while `on` cost about 7% more per run. The judge's scores of the open answers aren't calibrated yet.
- **It depends on undocumented Claude Code behaviour that is still changing.** Choosing the right rules means guessing which model a session or subagent will run on, especially after a resume, `/model`, compaction or fallback. Much of that comes from observing Claude Code 2.1.325–2.1.328, some of it checked only by hand (`docs/verification/claude-code.md`). Two bugs of this kind (F3 and F4) were found only last week. The check that a model actually reads the delivered context is marked "Not yet run" (row 39). Claude Code was already on 2.1.329 during the last run.
- **It touches every login on the machine.** By default, `noonsight install` writes hooks into every Claude Code configuration directory it finds in the home directory. It adds up to six hooks, each starting a Node process: about 60–120 ms of CPU per session start, subagent call or edit.

**Conditions and risks**

For it to work for you, all of these would have to hold:
- A tagged, published release that you pin.
- Someone on the team who reruns `npm run delivery -- all` and `npm run test:live` on every Claude Code upgrade before rolling it out.
- A decision on how task types get set (`NOONSIGHT_SCOPE`, `noonsight run`, or the classifier). Otherwise most of the preset never fires.
- `session.unattended_when_env` configured for your headless or CI runs, so they get the unattended rules.
- Routing left off. The CHANGELOG notes that in auto mode, an agent call that routing changes still leaves the other calls in the same response without the classifier's verdict, so they're refused until Claude makes them again.

What could go wrong:
- **A model gets the wrong rules.** This is the failure the delivery benchmark measures. Its last run on 2.1.328 had 3 of 300 sessions breaking its own rule (right rules in every request, any other model's only with a note retiring them), plus one documented limit: a compacted conversation resumed on Claude Code's default model. The CHANGELOG says the F3 and F4 fixes came after that run, so they haven't been re-measured at that scale.
- **Fallback models get no rules.** Claude Code's automatic fallbacks to models outside the preset, such as `claude-opus-4-8` and `claude-sonnet-5` in the benchmark, get only a note and a warning.
- **A preset update changes rules without anyone acting.** The default `warn` mode delivers the new rules and shows a warning; `hold` keeps the old ones until someone runs `noonsight accept`.
- **Cost goes up** by a few percent on every run.

**Pilot instead:** you could get most of the measured benefit with less exposure. Install with `--account` for two or three volunteers who use Sonnet or Haiku, with the shipped preset and routing off. After two weeks, compare `noonsight report` against how sessions actually went.

**What it guarantees:** nothing formal. It aims to give each session and subagent only the rules for the model it runs on, and in testing that held for 99.5% of requests. That figure rests on simulated sessions on Claude Code 2.1.328 and on its own observations of how Claude Code picks models and passes on hook output, which any Claude Code update can change without notice.
