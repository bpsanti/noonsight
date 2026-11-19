# Benchmark pilot, 2026-11-16 to 2026-11-19

The pilot's primary measure is whether the rules reach the model they were written for.
noonsight put each model's own rules in every path the delivery probe checks (7 of 7), and other models' rules in none of them except after a model switch, where the earlier model's rules stay in the conversation's history alongside noonsight's note that they no longer apply.
One user `CLAUDE.md` holding every model's rules reached 5 of 7 paths, missed the Explore and Plan subagents, and everywhere it reached it carried the other three models' rules along with the model's own: only 18 to 29 percent of the rule text a model received was written for it, against 100 percent under noonsight in the paid runs.
A `CLAUDE.md` that only points to a rules file delivered nothing by itself in any path (0 of 7): the rules arrive only if the agent opens the file.
In the 588 paid runs, every condition delivered exactly what it is meant to, run by run.

Cost and outcomes are secondary.
A run cost 7 percent more with noonsight's rules than without them, 19 percent more with every model's rules in one `CLAUDE.md`, and 25 percent more with the pointer and its rules file, in the round every condition ran.
The verifier saw no measurable difference between the conditions on this task set: Fable 5.2 and Opus 5.5 resolved nearly every task under every condition, and the Sonnet 5.5 and Haiku 5.5 samples are small.
This is not a claim about quality.

## What ran

| Item | Value |
| --- | --- |
| Dates | Nights of 2026-11-16 to 2026-11-19 |
| Claude Code | 2.1.326 |
| Harbor | 0.26.0 |
| Effort | `medium` for every model |
| Place | `unattended` (`NOONSIGHT_EXPERIMENT` set in the task container) |
| Models | Fable 5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5 |
| Tasks | 21: 12 SWE-bench Verified (build), 6 Terminal-Bench 2.1 (routine), 2 issue digests, 1 ReviewBench review |
| Conditions | `off`, `on`, `claudemd` (two rounds each), `scattered` (one round) |
| Runs | 588 results: 168 each for `off`, `on` and `claudemd`, 84 for `scattered`; 9 infrastructure failures, left out |
| Cost | $92.46 for the runs and $23.70 for the judge, as Claude Code reports it at list price; $119.15 counted against the $200 cap, which also counts interrupted runs at their budget |

The conditions, the tasks and the order are in [../../preregistration.md](../../preregistration.md), with every change made after it was written in its "Deviations" section.
Each result line names the noonsight commit that ran it, and the task and condition hashes.
The investigate set left the pilot before it produced a result (its images are amd64 only, and Claude Code could not run under amd64 emulation on the pilot's machine), so the pilot has no investigate task.

## Primary result: delivery

### The delivery probe

The probe ([../../README.md](../../README.md), "The delivery probe") drives one interactive Sonnet 5.5 session per condition against a local stand-in for the API, which records every request.
It starts three kinds of subagent, switches to Haiku 5.5 with `/model`, then runs `/compact` and `/clear`.
For each path, the table says whether the rules written for the request's model are in the request, and whose other rules came along.

| Path | Model of the request | `on` | `claudemd` | `scattered` |
| --- | --- | --- | --- | --- |
| start | Sonnet 5.5 | yes | yes (+ Fable, Opus, Haiku) | no |
| subagent general-purpose | Sonnet 5.5 | yes | yes (+ Fable, Opus, Haiku) | no |
| subagent Explore | Sonnet 5.5 | yes | no | no |
| subagent Plan | Sonnet 5.5 | yes | no | no |
| after `/model haiku` | Haiku 5.5 | yes (+ Sonnet) | yes (+ Fable, Opus, Sonnet) | no |
| after `/compact` | Haiku 5.5 | yes | yes (+ Fable, Opus, Sonnet) | no |
| after `/clear` | Haiku 5.5 | yes | yes (+ Fable, Opus, Sonnet) | no |

The probe's own output is in [delivery-probe/](delivery-probe).

The pre-registered share of the delivered rule text written for the request's model, per path ([summary.md](summary.md)); under `on` each model's text is the preset's rules for the probe's build scope and unattended place, and under `claudemd` every default-on rule:

| Path | Model of the request | `on` | `claudemd` | `scattered` |
| --- | --- | --- | --- | --- |
| start | Sonnet 5.5 | 100% | 29% | no rule text |
| subagent general-purpose | Sonnet 5.5 | 100% | 29% | no rule text |
| subagent Explore | Sonnet 5.5 | 100% | no rule text | no rule text |
| subagent Plan | Sonnet 5.5 | 100% | no rule text | no rule text |
| after `/model haiku` | Haiku 5.5 | 55% | 25% | no rule text |
| after `/compact` | Haiku 5.5 | 100% | 25% | no rule text |
| after `/clear` | Haiku 5.5 | 100% | 25% | no rule text |

- `on`: each path carries the rules of the request's model.
  After `/model haiku` the Sonnet rules are still in the request because they are in the conversation's history, from the session's start; noonsight adds the Haiku rules and a note that the earlier model's rules no longer apply.
- `claudemd`: the user `CLAUDE.md` is in the session's requests and the general-purpose subagent's, and not in the Explore and Plan subagents' requests, so those two subagents run without any rule.
  Where it loads, every model reads every model's rules: a Sonnet request carries the Fable, Opus and Haiku rules too.
- `scattered`: the pointer delivers no rule text.
  The stand-in API never opens files, so the table shows what reaches the model without the agent choosing to read the rules.

### The paid runs

Every run's decision log, and under `claudemd` and `scattered` its `InstructionsLoaded` records ([summary.md](summary.md), "Delivery check of the paid runs"), show what it received.
Under `off` and `on` no `CLAUDE.md` is written and no `InstructionsLoaded` hook is installed, so their having no `CLAUDE.md` holds by construction and was not observed.

| Condition | Runs | Received what the condition delivers |
| --- | --- | --- |
| `off` | 168 | 168: nothing from noonsight |
| `on` | 168 | 168: exactly the preset's rules for the run's model, scope and place |
| `claudemd` | 168 | 168: nothing from noonsight, and the user `CLAUDE.md` loaded at the session's start |
| `scattered` | 84 | 84: nothing from noonsight, and the pointer loaded at the session's start |

Every run of a model under a condition got the same text (one condition hash per model and condition).
The share of the rule text a run received that was written for its model was 100 percent under `on` for every model, and under `claudemd`, and under `scattered` once the file was opened, 29 percent for Fable 5.2 and Sonnet 5.5, 25 percent for Haiku 5.5 and 18 percent for Opus 5.5.
No paid run started a subagent, so the subagent paths are measured by the probe only.

Under `scattered`, all 84 agents opened the rules file, 83 of them before their first edit, because the pointer tells them to.
That is the agent's choice in each session, not something the setup guarantees.
Once the file is read, the session holds every model's rules, as under `claudemd`.

The paid runs also show the model changing inside a session.
On one routine task, `vulnerable-secret`, Claude Code switched the model by itself in 20 of the 21 runs by Fable, Opus and Sonnet, under every condition: Fable 5.2 and Opus 5.5 to Opus 4.8, and Sonnet 5.5 to Sonnet 5.
Under `on`, noonsight's hook saw each switch and told the session that the earlier model's rules no longer apply (`note`, 5 runs).
Under `claudemd` and `scattered`, the rules written for the 5.x models stayed in the session of the model that took over, which none of them was written for, and nothing in the session said so (9 runs).
The 20 switches are listed in [summary.md](summary.md).

## Secondary results

### Cost per run

Mean cost per run as Claude Code reports it, round 1, where every condition ran the same 84 cells:

| Model | `off` | `on` | `claudemd` | `scattered` |
| --- | --- | --- | --- | --- |
| Fable 5.2 | $0.319 | $0.330 | $0.369 | $0.383 |
| Opus 5.5 | $0.184 | $0.194 | $0.223 | $0.239 |
| Sonnet 5.5 | $0.070 | $0.086 | $0.090 | $0.091 |
| Haiku 5.5 | $0.009 | $0.010 | $0.010 | $0.010 |
| All | $0.145 | $0.155 | $0.173 | $0.181 |

Over both rounds of the three conditions that ran twice, the means are $0.141 (`off`), $0.151 (`on`) and $0.168 (`claudemd`).
The input tokens per run, and the tables per model for both rounds, are in [summary.md](summary.md).
Part of the cost of `claudemd` and `scattered` is the text itself: every turn reads all four models' rules, where `on` reads one model's.

### Outcomes

Build and routine tasks have a verifier.
On this task set there is no measurable difference between the conditions: 133, 132, 133 of 144 runs resolved under `off`, `on` and `claudemd`, and 66 of 72 under `scattered`.
Fable 5.2 and Opus 5.5 are at the ceiling (one unresolved run in 252 between them), and the Sonnet 5.5 and Haiku 5.5 samples, 36 runs per condition each, are too small to show a difference of a few tasks.
The table per model is in [summary.md](summary.md).

The open answers (digest and review) were graded by a Claude Opus 5.5 judge with three votes per item.
The judge is not calibrated yet, so its scores are reported in [summary.md](summary.md) as they came and are not read here.

## Open

- Calibrating the judge against about 15 of the author's blind grades (`npm run benchmark -- calibration`) is not done.
- Expanding the pilot into the full study is not planned yet.

## Limitations

- Build tasks come only from the SWE-bench Verified instances with a native arm64 image, which over-represent Django, SymPy and Sphinx.
- One review task and two digests check the harness and the judge; they say little about those kinds of task.
- The judge is a Claude model grading Claude models.
- The paid runs started no subagent and switched models only on one task, so most of the paths a rule can take are measured by the probe, on one session per condition.
- Cost is Claude Code's estimate at list price.

## Files

| File | What it holds |
| --- | --- |
| `runs.jsonl` | One line per run: tokens, cost, turns, wall time, the verifier's verdict, what noonsight delivered, the instruction loads, the signals and the pins; infrastructure failures are kept with `infra_failure` set |
| `signals.jsonl` | The signals of every run, computed again from its saved event stream (`npm run benchmark -- rescore`); the summary reads these |
| `decisions.jsonl` | noonsight's decision log of every run, for `noonsight report --log` |
| `grades.jsonl` | The judge's grades, including the ones that failed and were asked again |
| `delivery-probe/` | The delivery probe's table and its rows as JSON |
| `summary.md` | What `npm run benchmark -- summarize --results experiments/benchmark/results/2026-11-19` prints from the files above |
