# Delivery benchmark

Do the rules written for a model reach every request that model receives, and only those rules, whatever happens to the session?
This folder measures that, for noonsight and for the native alternatives (`CLAUDE.md`, `.claude/rules`, a skill per model), on real Claude Code sessions.
It measures delivery only: whether the text arrives, not what the model does with it, which is what [experiments/rules](../rules/README.md) and [experiments/benchmark](../benchmark/README.md) measure.

Nothing here sends a request to Anthropic or spends a token.
Each session is a real interactive Claude Code, with its own home, configuration directory and git project, talking through `ANTHROPIC_BASE_URL` to a local stand-in for the Messages API ([stub.ts](stub.ts)) with a placeholder login token.
The stub answers every request from the request alone and hands each one to the oracle, so every request Claude Code sends is measured.

## What a session is

A session starts on one of the four models (`--model`), with or without a task scope (`NOONSIGHT_SCOPE`), watched or unattended, and then runs a sequence of steps ([generate.ts](generate.ts)):

| Step | What the driver does |
| --- | --- |
| `turn` | A prompt the stub answers with a short text |
| `spawn` | A prompt the stub answers with one to three agent calls in the same response (`general-purpose`, `Explore` or `Plan`, with or without the `model` parameter) |
| `edit` | A prompt the stub answers with a Read and an Edit of a tracked code file or a tracked document, or a Write of a new file |
| `/model` | Switches to another model |
| `/compact`, `/clear` | The commands |
| `resume` | Leaves the session and comes back with `claude --continue`, with or without `--model` |

The driver ([session.ts](session.ts), [pty-bridge.py](pty-bridge.py)) types into a pseudo-terminal and waits for a signal, not for a fixed time: the file a `Stop` hook writes, the decision log line the step causes, or a quiet spell with no request.

## The invariant

On every request of the session's own conversation and of each subagent ([oracle.ts](oracle.ts)):

| Class | What it requires |
| --- | --- |
| `missing-own` | Every right rule of the request's model is in the request. |
| `own-retired` | No model-change note that retires the request's model comes after the last copy of one of its right rules. |
| `foreign-unretired` | A rule written only for other models is in the request only when a model-change note naming one of its owners comes after its last copy. |

The right rules of a request are what noonsight's own resolver gives for the request's model, the session's scope and place, and the triggers the session has revealed, on a reference configuration where every model uses the preset; a subagent is resolved for the place `subagent`, with no scope and no trigger.
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
   The hand-kept sequences in [corpus/](corpus), one per file, each with the outcome it must have under `on`: the delivery probe's session, one sequence per lifecycle path, and the shortest known reproduction of each open failure.
   An entry that reproduces a known failure names the violations it must show, so the corpus stays green while the failure is open and goes red when it is fixed; the entry's `expect` then becomes `"pass"`.
   Run it before each release and on each new Claude Code version.
2. **Fuzz.**
   Random sequences from a seed ([fuzz.ts](fuzz.ts)): 300 sessions under `on`, and the first 60 of the same seed under each native arm.
   The same seed always gives the same sequences, so a result names its seed and nothing else is needed to run it again.
   A failing session is reduced by [shrink.ts](shrink.ts) to a shortest sequence that still shows the same class of violation, running every candidate as a real session; it keeps the class, not the cause, so after a fix run the fuzz level again, not only the corpus.
3. **Self-check.**
   The fuzzer must catch failures planted in a copy of the built hook ([plants.ts](plants.ts)), and the shrinker must reduce one to a short sequence that passes on the real build.
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
npm run delivery -- all                         # all of the above but shrink, for one Claude Code version
```

`--claude <binary>` runs another Claude Code version; `--concurrency` sets how many sessions run at once.
An interrupted fuzz run continues where it stopped when run again with the same arm, seed and size; `--fresh` starts it over.
`NOONSIGHT_LIVE_DELIVERY=1 npm run test:live` runs the corpus as a test (`test/live/delivery-corpus.test.ts`), next to the delivery probe of the benchmark pilot.
Nothing in this folder installs anything machine-wide, and it refuses to run where noonsight is installed machine-wide, since those hooks would run in its sessions too.

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
      corpus.json     the outcome of each corpus entry
      summary.json    the four measures of each run, by arm or plant (summary.md renders them)
      selfcheck.json  whether each plant was caught, and the sequence it shrank to
      agree.json      the decision log against the stub
      hooktime.json   the time of each hook
      failures/       one shrunk sequence per file
      sessions/       one line per session (not committed: the seed reproduces them)
```

The folder for one version holds what was measured on that version; comparing two versions is comparing their `summary.json` and `corpus.json`.

## Known failures

The corpus entries that start with `f1-` and `f2-` reproduce two failures of noonsight the fuzzer found.

- **F1, a pending delivery lost.**
  The hook that runs after `/model` returns the new model's rules and the note, and Claude Code adds them to the next request.
  When another `/model` or the end of the session comes first, that text reaches no request, while the decision log records it as delivered.
- **F2, the wrong model on resume.**
  On `claude --continue` without `--model`, the hook input names no model, and the hook takes the `model` setting before the session's record; but Claude Code runs the conversation on the model of its last response when there is one.
  `/model` writes the setting, so a resume after a switch can get another model's rules and a note that retires its own, and its subagents are predicted on the wrong model.

## Limits

- The stub answers with fixed texts and never decides anything: each subagent makes one request, no subagent edits a file, and no session compacts by itself.
- The generator has no `/resume` inside a session, fork, plan mode, agent teams, the `noonsight run` launcher, routing, the classifier or a project configuration; the only trigger is `code-edit` and the only rules are the preset's.
- The reference is noonsight's own resolver: a wrong resolution would not show here, only a wrong delivery.
- Times depend on the machine and on what else runs on it.
