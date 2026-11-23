**Verdict: adopt with conditions.** Run it as a small pilot on a pinned Claude Code version, not as a team-wide or machine-wide install yet.

I read the README, the hooks contract, the evidence map, the Claude Code verification list and the delivery benchmark's limits. I did not run the tests or the tool. I spot-checked two evidence figures against the raw result file (both matched) and searched `src/` for network code (none).

## Reasons

- **It fits your setup.** It delivers per-model rules to each session and subagent, and re-delivers on `/model`, `/compact`, `/clear`, resumes and forks.
- **The real gain over `CLAUDE.md` is subagents.** In its benchmark, a `CLAUDE.md` reached 100% of the main conversation's requests (448 of 448) but only 46.9% of subagent requests (60 of 128), and never reaches Explore or Plan subagents. noonsight reached 763 of 763.
- **It keeps other models' rules out.** Under noonsight 78.6% of the rule text in a request was written for that request's model, against 32.6% with a shared `CLAUDE.md`.
- **Low blast radius.** The hooks always exit 0, never deny a call, and have no network code. Runtime dependencies are zero, `noonsight uninstall` removes the hooks, and `NOONSIGHT_DISABLE=1` turns it off per session.
- **The evidence is unusually honest.** Every number traces to a committed raw file, and the docs list nine delivery failures the benchmark found and fixed, plus the known limits.
- **Better outcomes are not shown.** On public tasks the paid pilot passed 133 of 144 without rules, 132 with noonsight and 133 with a `CLAUDE.md`, and noonsight cost about 7% more per run ($0.155 against $0.145).
- **The measured rule effects are narrow.** `verify-changes` made Sonnet and Haiku run tests after a small fix (0 of 30 without it), but roughly doubled that fix's cost, and every run passed its hidden check either way. Sonnet's `carry-through` raised full completion on a 13-ticket backlog from 9 to 32 of 40. No Opus rule has any measured effect.
- **It is very young.** It is version 0.0.1, not on npm, in one author's repository, and all evidence dates from 14 to 23 November 2026. All nine failures were found in that window, the last five in the newest run.

## Conditions and risks

Conditions:
- **Have rules that differ by model.** If your rules are the same for every model, a `CLAUDE.md` is simpler; the README says so itself.
- **Pin Claude Code.** The delivery claim holds on 2.1.330 only, and the project's CI still pins 2.1.325. Re-run its delivery benchmark before each upgrade.
- **Configure Opus and Fable deliberately.** Out of the box, an attended session on either receives nothing from the preset; you must `enable` rules or write your own.
- **Install from a reviewed, pinned commit.** The npm name currently holds an empty placeholder, so do not use `npx noonsight`.
- **Leave routing, the classifier and the watcher off.** None is covered by the delivery benchmark, and the classifier sends task text to a model through your login.
- **Start per-account.** The machine-wide install is not checked live.
- **Review `noonsight report` after two weeks.** Drop rules that change nothing you can see.

Risks:
- **Breakage on Claude Code updates.** It relies on undocumented behaviour (an undocumented environment variable, transcript and job-file fields, code read from the Claude Code bundle). The hooks fail open, so a break shows as missing or wrong-model rules and warnings, not a blocked session.
- **Subagent gaps that matter to you.** Workflow agents get nothing. Parallel foreground subagents of one type that need different rules get nothing until their first Edit, Write or agent call. Agent teams are unmeasured.
- **Unresolvable models.** With `opusplan`, `default`, or aliases on Bedrock, Vertex or Foundry without pinning variables, it warns and delivers nothing.
- **Cost and latency.** Each hook run takes roughly 80 to 150 ms of processor time, and rules that add work add spend.
- **Committed rules are an injection surface.** A repository's `.noonsight/noonsight.json` is ignored until each person runs `noonsight trust`, which is the right default; treat changes to those files as code review items.
- **The install edits `settings.json` for every Claude Code login on the account.**
- **`/fork` stops working** in sessions started through `noonsight run` with rules.

## What it guarantees

It guarantees delivery, not obedience: on Claude Code 2.1.330, every request that was due rules carried its own model's rules and no other model's unretired ones. That rests on one benchmark run of 299 generated sessions against a stand-in API, scored against noonsight's own resolver.
