# Delivery benchmark

Do the rules written for a model reach every request that model receives, and only those rules, whatever happens to the session?
This folder measures that, for noonsight and for the native alternatives (`CLAUDE.md`, `.claude/rules`, a skill per model), on real Claude Code sessions.
It measures delivery only: whether the text arrives, not what the model does with it, which is what [experiments/rules](../rules/README.md) and [experiments/benchmark](../benchmark/README.md) measure.

Nothing here sends a request to Anthropic or spends a token.
Each session is a real interactive Claude Code, with its own home, configuration directory and git project, talking through `ANTHROPIC_BASE_URL` to a local stand-in for the Messages API ([stub.ts](stub.ts)) with a placeholder login token.
The stub answers every request from the request alone and hands each one to the oracle, so every request Claude Code sends is measured.

## What a session is

A session starts on one of the four models (`--model`), with or without a task scope (`NOONSIGHT_SCOPE`), attended or unattended, through `claude` or `noonsight run`, in a project with or without a noonsight configuration of its own, and then runs a sequence of steps ([generate.ts](generate.ts)):

| Step | What the driver does |
| --- | --- |
| `turn` | A prompt the stub answers with a short text |
| `spawn` | A prompt the stub answers with one to three agent calls in the same response (`general-purpose`, `Explore` or `Plan`, with or without the `model` parameter); a `general-purpose` subagent may be told to edit, and then reads and edits the tracked code file before it answers |
| `edit` | A prompt the stub answers with a Read and an Edit of a tracked code file or a tracked document, or a Write of a new file |
| `/model` | Switches to another model |
| `/compact`, `/clear` | The commands |
| `resume` | Leaves the session and comes back with `claude --continue`, with or without `--model`, and with or without `--fork-session`, which goes on in a copy of the conversation under a new session id |
| `/branch` | Goes on in a copy of the conversation under a new session id, in the same process |
| `/fork` | Runs a copy of the conversation as a background session, with a prompt it answers; the session goes on as it was |
| `/resume` in the session | `/resume <id>`, back to the conversation the session was in before the current one, the one `/clear`, `/branch` or a forking resume left |
| `/plan`, plan off | Turns plan mode on with `/plan`, and off with shift+tab; in plan mode only turns, `/model` and `/compact` are drawn: an agent call or an edit waits for approval there, and a conversation left in plan mode comes back in plan mode when another process resumes it |

A session that starts through `noonsight run` goes through it at every launch, resumes included.
A session in a project has the configuration in [project/](project) as its `.noonsight/noonsight.json`, which the session's account trusts (`noonsight trust`): a rule for every model, one for subagents only, and one each for Sonnet 5.5 and Fable 5.2 in some scopes.

The driver ([session.ts](session.ts), [pty-bridge.py](pty-bridge.py)) types into a pseudo-terminal and waits for a signal, not for a fixed time: the file a `Stop` hook writes, the decision log line the step causes, or a quiet spell with no request.
A plan step waits for the footer to name the mode: "plan mode on" after `/plan`, and "manual mode on" after shift+tab, which it presses again while the footer names another mode, since after plan mode the cycle goes to auto mode on some models.
A turn's `Stop` hook names the permission mode too, so a session that is not in plan mode when its sequence says it is, or not in the default mode otherwise, is recorded as one the driver could not run (`wrong-mode`).
A `/fork` session runs in a daemon Claude Code starts for the configuration directory, which outlives the session; the driver stops it when the session ends.
Claude Code refuses `/fork` in a session started with a system prompt of its own, as `noonsight run` starts one with rules; the step is then recorded as `fork-refused` and the session goes on, and a `/fork` that neither answers nor is refused within two minutes ends the session as not driven.

### Two generators

The fuzz level draws sequences with a generator version, and the same version, seed and index always give the same sequence.
Version 1 draws the steps and starts of the runs up to 2026-11-21: no `noonsight run`, no project configuration, no fork, no `/resume` in the session, no plan mode and no subagent that edits.
Version 2, the default, draws all of them, from the same seed: a session starts through `noonsight run` one time in five and in the project one time in four, and the steps version 1 does not have come with lower weights than the others.
`--generator 1` draws version 1's sequences again, so a design of [plan.json](plan.json) written for those runs compares like with like; its sessions files keep the names they had (`on-s1-n300`), while version 2's carry `g2-` before the seed (`on-g2-s1-n300`), and sequences of two versions never pair.

## The invariant

On every request of the session's own conversation and of each subagent ([oracle.ts](oracle.ts)):

| Class | What it requires |
| --- | --- |
| `missing-own` | Every right rule of the request's model is in the request. |
| `own-retired` | No model-change note that retires the request's model comes after the last copy of one of its right rules. |
| `foreign-unretired` | A rule written only for other models is in the request only when a model-change note naming one of its owners comes after its last copy. |

The right rules of a request are what noonsight's own resolver gives for the request's model, the session's scope and place, and the triggers the session has revealed, on a reference configuration where every model uses the preset, with the project's configuration laid over it for a session in the project; a subagent is resolved for the place `subagent`, with no scope and no trigger.
A session reveals `code-edit` from the request that carries the result of its own successful edit of the tracked code file, and so does every copy of its conversation a fork makes; a subagent's edit reveals nothing for the session.
A `/fork` session runs headless, so its requests are resolved for the place `unattended`, with the session's scope.
Every arm is measured against that same reference.
A rule is in a request when the first 160 characters of its text are in the request's text, read in the order the model reads it; a text two models share belongs to both.

One violation is documented and counted apart: several open agent calls of one type that would get different rules leave their subagents without rules (`docs/hooks.md`, "SubagentStart: the rules").

## The four measures

[measure.ts](measure.ts) computes them from what the stub saw:

| Measure | Definition |
| --- | --- |
| Coverage | Among the requests whose model has at least one right rule, the share where `missing-own` and `own-retired` both hold; also by rule, and for subagents alone. |
| Precision | The own share: characters of rules written for the request's model over all rule text in the request, each copy counted. The right share, stricter: the first copy of each right rule over all rule text plus noonsight's envelopes and notes. The rest is split into repeated copies, the model's own rules that do not apply there, other models' rules a note retires, and other models' rules with no note. |
| Cost | The characters added to each request (rules, envelopes, notes), with tokens estimated at four characters each, per request and per session; and the time of each hook run ([hooktime.ts](hooktime.ts)), with how many runs each step causes. |
| Robustness | Violations per request and per session, by number of lifecycle events in the session, by whether two quiet steps (`/model`, `/compact`, `/clear`, resume) follow each other with no request between them, and by path (the last lifecycle step before the request); each distinct class with an example session. |

Sessions the driver could not run (`harness` other than `ok`) are counted and left out of the measures.

## The three levels

From the cheapest to the most expensive:

1. **Corpus.**
   The hand-kept sequences in [corpus/](corpus), one per file, each with the outcome it must have under `on`: the delivery probe's session, one sequence per lifecycle path, the shortest reproductions of the failures the fuzzer found, which must pass since their fix, and the documented limits.
   An entry that reproduces an open failure or a limit names the violations it must show, so the corpus stays green while it holds and goes red when it changes; the entry's `expect` then becomes `"pass"`.
   An entry marked `exact` also fails on a request that holds a rule of its model that is not due there, which the invariant leaves to the precision measure; `subagent-edits` uses it, since a trigger revealed by a subagent's edit would show only that way.
   Run it before each release and on each new Claude Code version.
2. **Fuzz.**
   Random sequences from a seed ([fuzz.ts](fuzz.ts)): 300 sessions under `on`, and the first 60 of the same seed under each native arm.
   The same seed always gives the same sequences, so a result names its seed and nothing else is needed to run it again.
   A failing session is reduced by [shrink.ts](shrink.ts) to a shortest sequence that still shows the same class of violation, running every candidate as a real session; it keeps the class, not the cause, so after a fix run the fuzz level again, not only the corpus.
3. **Self-check.**
   The fuzzer must catch failures planted in a copy of the built hook ([plants.ts](plants.ts)), and the shrinker must reduce one to a short sequence that passes on the real build.
   The plants: a `/model` switch with no note (`no-switch-note`), a compaction treated as a resume (`compact-as-resume`), and a fork's start that knows nothing of the conversation it copied (`fork-unknown`), which brings F5 and F6 back.
   A plant whose line is no longer in the build refuses to apply, and `npm test` checks every plant's line is there.
   Run it when the generator, the stub, the driver or the oracle change.

## The arms

| Arm | noonsight's configuration | What else the session has |
| --- | --- | --- |
| `on` | Every model `"use": "preset"` | Nothing |
| `claudemd` | Every model `"use": "none"` | A user `CLAUDE.md` with every model's rules under a heading per model, as the benchmark pilot's `claudemd` condition |
| `rules` | Every model `"use": "none"` | `.claude/rules/<model>.md` in the project, one per model, since `.claude/rules` has no selector by model; the rules noonsight delivers on a code edit go in a second file per model, scoped with `paths:` to the code files |
| `skills` | Every model `"use": "none"` | A skill per model whose description says to load it on that model |
| `off` | noonsight not installed | Nothing |

[arms.ts](arms.ts) writes them.
`noonsight run` and the project's configuration are noonsight's own, and the native arms have no counterpart of either, so under them a session drawn to start that way starts through `claude`, in a project without noonsight's configuration, and is measured against the reference without the project.
A native arm whose text never reaches the session's first request is recorded as `arm-not-loaded`, a harness failure: Claude Code does not load a user `CLAUDE.md` or `.claude/rules` for a project inside one of its own scratchpad folders, so the sessions must run elsewhere (the default is the system's temporary directory).
The stub never decides to open a skill, so `skills` measures what that arm guarantees, which is only the skill's description.

## Running it

Needs `claude`, `python3`, `git` and Node.js 20 or later; no login.

```bash
npm run delivery -- corpus                      # the corpus, a few minutes
npm run delivery -- fuzz --n 300                # 300 sessions under on, seed 1
npm run delivery -- fuzz --arm claudemd --n 60  # the first 60 of the same seed under a native arm
npm run delivery -- selfcheck                   # every plant, on the first 60 sessions of seed 1
npm run delivery -- shrink --sessions <results>/sessions/on-s1-n300.jsonl --id on-s1-0170
npm run delivery -- measure                     # summary.json and summary.md from every sessions file
npm run delivery -- agree                       # the decision log against the stub
npm run delivery -- hooktime                    # the time of each hook
npm run delivery -- compare --design after-f1-f2 --results <results>  # a design's comparisons against an earlier run
npm run delivery -- all                         # all of the above but shrink, for one Claude Code version
npm run delivery -- corpus --install plugin     # the corpus, with noonsight installed as a Claude Code plugin
npm run delivery -- fuzz --generator 1 --n 300  # the sequences of the runs up to 2026-11-21
```

`--claude <binary>` runs another Claude Code version; `--noonsight <dir>` installs another build of noonsight in the sessions, such as one from before a fix, while the harness and the reference stay this checkout's; `--install plugin` installs the same build as a Claude Code plugin (`npm pack`, a local marketplace, `claude plugin install`; `plugin.ts`) in place of the settings hooks, and `--install both` adds it to them; `--concurrency` sets how many sessions run at once.
An interrupted fuzz run continues where it stopped when run again with the same arm, seed and size; `--fresh` starts it over.
`NOONSIGHT_LIVE_DELIVERY=1 npm run test:live` runs the corpus as a test (`test/live/delivery-corpus.test.ts`), next to the delivery probe of the benchmark pilot.
Nothing in this folder installs anything machine-wide, and it refuses to run where noonsight is installed machine-wide, since those hooks would run in its sessions too.

### Comparing two runs

`plan.json` holds designs: each names the run it compares against (`before`, a folder under `results/`), the command it runs, and its comparisons, fixed before it runs.
`npm run delivery -- compare --design <name> --results <folder>` evaluates them on that folder and writes `comparison.json` and `comparison.md` there ([compare.ts](compare.ts)).
A comparison reads one measure on two sides, each a run of one of the two folders or the first sessions of one, and says how the second side should relate to the first.
A paired comparison also pairs the sessions of the same sequence that ran on both sides, and counts those where only one side failed or had a request without its right rules; its p is the exact McNemar test, which fits the design since a seed gives every arm and every build the same sequences.
Holm's adjustment runs over the primary comparisons, and a primary comparison is supported when its measure moves the way it expects and its adjusted p is below the design's alpha.
The others are read from the measure alone.
Sessions files are not committed, so a paired comparison against an older run needs that run's `sessions/` folder in place; without it, only the measures compare.

### The design `after-f1-f2`

The run of 2026-11-19 at `467d465` measured the fuzz level and the native arms before the fixes of F1 and F2; after them, only the corpus and the self-check ran.
The design `after-f1-f2` runs the fuzz level and the native arms again on the fixed build, with what makes the two runs comparable held fixed: Claude Code 2.1.328, the same command (`all`), seed 1, 300 sessions under `on` and the first 60 under each native arm.
Only the concurrency changes, from 6 to 2 sessions at once, which changes how long steps take but not the sequences.
Its comparisons:

| | Question | Measure | Expects | Paired on |
| --- | --- | --- | --- | --- |
| P1, primary | Fewer sessions under `on` break the invariant in a way nothing documented explains | Sessions with an unexplained violation, before and after | Lower | Failing sessions |
| P2, primary | Coverage under `on` is higher | Coverage, before and after | Higher | Sessions with a request without its right rules |
| P3 to P5, primary | On the same 60 sequences, coverage is higher under `on` than under `claudemd`, `rules` and `skills` | Coverage, each arm against the first 60 `on` sessions of the same run | Higher | Sessions with a request without its right rules |
| P6 to P8, primary | The same for subagents | Subagent coverage | Higher | Sessions with a subagent request without its right rules |
| C1 to C3, controls | `claudemd`, `rules` and `skills` are unchanged, since noonsight delivers nothing under a native arm | Coverage, before and after | The same, and no session that changed | Sessions with a request without its right rules |
| S1 | Under `on`, coverage is higher in the sessions with two quiet steps in a row | Coverage of those sessions | Higher | |
| S2 | Under `on`, fewer requests hold another model's rule with no note | Requests with `foreign-unretired` | Lower | |
| S3 | Under `on`, subagent coverage is no lower | Subagent coverage | Not lower | |
| S4 | The decision log gives the coverage the stub saw under `on` | `agree.json`, the log against the stub | The same | |
| R1 to R3 | Under `on`, the own share, the right share and the characters added per request | | Reported only | |

The prediction behind P1 and S1: every failing session before the fixes had two quiet steps in a row, the shape F1 and F2 need, so after them no session should fail but those a documented limit explains.
A failing session after the fixes is read one by one: one that a documented limit explains is recorded as such, and any other is a new defect, shrunk with `shrink` and recorded in the results' `failures/` folder, not fixed in the same change.
The controls check the harness: noonsight's configuration under a native arm is `"use": "none"`, so a native arm that changed would mean the sessions are not as repeatable as the comparison assumes.

### The design `after-f3-f4`

The run of 2026-11-20 at `4e18c43` found F3 and F4; after their fixes, only the corpus ran.
The design `after-f3-f4` runs the whole benchmark again on the fixed build, with what the design `after-f1-f2` held fixed held fixed again: Claude Code 2.1.328, the command `all`, seed 1, 300 sessions under `on`, the first 60 under each native arm, and 2 sessions at once.
At most the three sessions that failed in that run can stop failing, too few for a paired test to reach the alpha, so no comparison is primary and each is read from its measure alone:

| | Question | Measure | Expects | Paired on |
| --- | --- | --- | --- | --- |
| K1 | Fewer sessions under `on` break the invariant: only `s1-0096`, the documented limit, should still fail | Sessions with an unexplained violation, before and after | Lower | Failing sessions |
| K2 | Coverage under `on` is higher | Coverage, before and after | Higher | Sessions with a request without its right rules |
| K3 | Under `on`, fewer requests hold another model's rule with no note | Requests with `foreign-unretired` | Lower | |
| K4 | Under `on`, subagent coverage is no lower | Subagent coverage | Not lower | Sessions with a subagent request without its right rules |
| C1 to C3, controls | `claudemd`, `rules` and `skills` are unchanged | Coverage, before and after | The same, and no session that changed | Sessions with a request without its right rules |
| S4 | The decision log gives the coverage the stub saw under `on` | `agree.json`, the log against the stub | The same | |
| R1 to R3 | Under `on`, the own share, the right share and the characters added per request | | Reported only | |

A failing session other than `s1-0096` is read one by one as in the design `after-f1-f2`, and a new defect is recorded, not fixed in the same change.

### The decision log

`npm run delivery -- log` computes the same measures from a decision log alone (`~/.local/state/noonsight/decisions.jsonl`, or `--file`), split by the place each session started in, and prints aggregates only.
The log records what the hook returned to Claude Code, not what reached the model, so it cannot see a delivery Claude Code dropped; `agree` measures how far it can be trusted, on benchmark sessions where the stub saw every request.
Never commit a real decision log or anything taken from one but aggregates.

## Results

Results are kept per Claude Code version, then per date and noonsight commit:

```text
results/
  claude-code-<version>/
    <date>-<commit>/
      run.json        the Claude Code version, commit, preset version, platform, and each command run
      corpus.json     the outcome of each corpus entry (corpus-plugin.json and corpus-both.json under --install)
      summary.json    the four measures of each run, by arm or plant (summary.md renders them)
      selfcheck.json  whether each plant was caught, and the sequence it shrank to
      agree.json      the decision log against the stub
      hooktime.json   the time of each hook
      comparison.json the comparisons of a design in plan.json against an earlier run (comparison.md renders them)
      failures/       one shrunk sequence per file
      sessions/       one line per session (not committed: the seed reproduces them)
```

The current run is the one of 2026-11-23 on Claude Code 2.1.330 ([README](results/claude-code-2.1.330/2026-11-23-c5b9130/README.md)); every run on 2.1.328 is superseded by it, and [docs/evidence.md](../../docs/evidence.md#runs-and-versions) lists them all.
The folder for one version holds what was measured on that version; comparing two versions is comparing their `summary.json` and `corpus.json`.

## Failures found, and a limit

The corpus entries that start with `f1-` to `f9-` are the shortest reproductions of nine failures of noonsight: F1 to F4 the fuzzer found, F5 to F9 the paths generator 2 added.
All nine are fixed, and their entries must pass.

- **F1, a pending delivery lost.**
  The hook that runs after `/model` returns the new model's rules and the note, and Claude Code adds them to the next request.
  When another `/model` or the end of the session came first, that text reached no request, while the decision log recorded it as delivered.
  noonsight now treats a switch's delivery as unconfirmed (`docs/hooks.md`, "PostModelSwitch").
- **F2, the wrong model on resume.**
  On `claude --continue` without `--model`, the hook input names no model, and the hook took the `model` setting before the conversation's own model; but Claude Code runs the conversation on the model of its last response when there is one.
  `/model` writes the setting, so a resume after a switch got another model's rules and a note that retired its own, and its subagents were predicted on the wrong model.
  noonsight now reads the conversation's last response from the transcript (`docs/hooks.md`, "SessionStart").
- **F3, a resume's delivery lost to another resume.**
  Two resumes with `--model` and no request between them: the first resume's rules and note reach no request, and the second resume's note retires only the first resume's model, so the model the session started on keeps its rules with nothing retiring them (`f3-two-resumes`).
  It is F1 with a resume in place of `/model`.
  noonsight now treats a resume's delivery as unconfirmed until the transcript holds a response of the conversation from after it (`docs/hooks.md`, "SessionStart").
- **F4, the resumed model after a switch from Sonnet to Haiku.**
  After `/model haiku` in a conversation that last answered on Sonnet, a resume without `--model` runs on Haiku, the model setting, while the hook took Sonnet, the model of the last response, since the fix of F2 (`f4-resume-after-switch-from-sonnet`).
  Under the setting `haiku`, written exactly so, Claude Code resumes a conversation that last answered on Haiku or Sonnet on Haiku, and noonsight now does the same (`docs/hooks.md`, "SessionStart").

F3 and F4 were found by the run [after the fixes of F1 and F2](results/claude-code-2.1.328/2026-11-20-4e18c43/README.md), superseded since.
The run [after the fixes of F3 and F4](results/claude-code-2.1.328/2026-11-21-d5fd71f/README.md), superseded by the run with generator 2 below, measured the fuzz level again: all 300 sessions under `on` ran to the end and one of the 300 breaks the invariant, and it is the documented limit below.

- **F5, a fork with no record.**
  A fork goes on in a copy of a conversation under a new session id, and noonsight's record was by session id, so a fork's start found none: it delivered its model's rules with no note, while the copy held the original model's rules, and a switch's delivery that had not arrived yet (`f5-fork-session-to-another-model`, `f5-branch-after-switch`, `f5-fork-after-switch`).
  It holds for the three ways Claude Code forks: `--fork-session`, `/branch` and `/fork`.
  noonsight now finds the conversation the fork copied and takes its record, last response and triggers; with none found, its note retires the rules of every model but the fork's own (`docs/hooks.md`, "Forks").
- **F6, the wrong model on a fork in a new process.**
  `claude --continue --fork-session` without `--model` runs on the model of the conversation's last response, as a resume does, but the fork's transcript is not written when its hook runs, so the hook took the `model` setting, which a `/model` since had changed (`f6-fork-session-after-switch`).
  It is F2 for a fork; noonsight now reads the last response from the original's transcript.

- **F7, the chosen model reported in plan mode.**
  In plan mode, Claude Code runs Sonnet for a session whose chosen model is Haiku, and says so with a model switch, but a compaction's start in plan mode reports Haiku, and `/clear` then took Haiku from the process's record: Haiku's rules went to Sonnet's requests (`f7-compact-in-plan-mode-on-haiku`, `f7-model-haiku-in-plan-mode`).
  noonsight now records the chosen model while Claude Code runs another in its place, and a compaction or `/clear` that reports the chosen model keeps the one that runs (`docs/hooks.md`, "SessionStart").
- **F8, the chosen model reported by `/resume` in plan mode.**
  The same as F7 for `/resume` typed in the session, whose start reports the model of the process, but in plan mode on Haiku the chosen one (`f8-resume-in-plan-mode-on-haiku`).
  noonsight now takes the process's record for every start in the same process that reports the chosen model.
- **F9, a resume's delivery dropped as a repeat.**
  Claude Code leaves out a `SessionStart` context identical to one an earlier start added to the same conversation.
  After a `/model` switch to a model with no rules there, whose note alone retired the starting model's rules, a resume or a fork back to the starting model delivered its rules again, the startup's very text, and no request held them (`f9-resume-repeats-startup-delivery`; in the fuzz run, a forking resume, `s1-0182`).
  It holds for any resume, not only the paths generator 2 added, which drew it first.
  A resume's or a fork's delivery now carries the time it was made in its opening tags (`docs/hooks.md`, "SessionStart").

F5 and F6 showed in the corpus entries written for the paths generator 2 added, and F7 to F9 in fuzz runs of generator 2 (`s1-0088`, `s1-0138` and `s1-0182` of seed 1) before their fixes: on the build before their fix, every one of these entries breaks the invariant (`foreign-unretired` in the session's own requests, with `missing-own` for F7 and F8, and `own-retired` for F9), and on the fixed build they pass.

The current run, [with generator 2 on Claude Code 2.1.330](results/claude-code-2.1.330/2026-11-23-c5b9130/README.md), measured the new paths after the fixes of F5 to F9: 300 sessions were generated under `on`, 299 ran to the end and none of the 299 breaks the invariant, and every request with rules due held them; the other, `s1-0123`, stopped on a turn that got no answer and is not measured.

`limit-default-model-after-compact` reproduces a documented limit: a conversation compacted with no response since and resumed with nothing that names a model runs on Claude Code's default model, which noonsight cannot tell, so the session's record decides.

## Limits

- The stub answers with fixed texts and never decides anything: a subagent makes one request, or three when it edits, a `/fork` session answers its one prompt, and no session compacts by itself.
- The generator has no agent teams, routing, classifier, or `opusplan` model; the only trigger is `code-edit`, and the only rules are the preset's and the project's.
  Routing and the classifier are off in the reference configuration, and `opusplan` picks its model by plan mode, which noonsight documents it cannot tell (`docs/hooks.md`, "SessionStart").
- Plan mode is left with shift+tab, never by approving a plan, since the stub writes no plan; and `/resume` in the session names the conversation, never picks it from the list.
- A fork from a new process is measured with `--continue`, which finds the original as the most recently written transcript; with another session of the same project writing its transcript at the same moment, noonsight could take that one (`docs/hooks.md`, "Forks").
- The reference is noonsight's own resolver: a wrong resolution would not show here, only a wrong delivery.
- Times depend on the machine and on what else runs on it.
