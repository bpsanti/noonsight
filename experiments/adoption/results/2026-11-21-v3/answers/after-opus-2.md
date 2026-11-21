**Verdict: adopt with conditions.** Run it as a limited pilot first, not a team-wide rollout.

**Reasons**

1. **It reaches subagents, which `CLAUDE.md` mostly doesn't.** On the same 60 test sessions, noonsight got the right rules into 100% of subagent requests. A user `CLAUDE.md` managed 32.2% (39 of 121), and it never reaches the built-in Explore and Plan subagents (`docs/evidence.md` D9, D10). You use subagents heavily, so this is the main reason to adopt.
2. **Each model gets its own rules instead of everyone's.** With `CLAUDE.md`, 31.6% of the rule text in a request was written for that request's model; with noonsight, 78.8%. It also adds about 1,150 characters per request, against 4,400 for `CLAUDE.md` (D12, D13). With four models in use, a shared `CLAUDE.md` hands each model three other models' rules.
3. **For a single session's own conversation, `CLAUDE.md` is already enough.** It reached 527 of 527 of those requests, through `/model`, `/compact`, `/clear` and resumes (D17). So noonsight only adds value for subagents and for keeping models' rules apart. The README says the same: skip it if everyone uses one model.
4. **Little of the shipped rule set reaches people working at the keyboard.** Most default rules only apply to unattended runs, subagents or a named task type ("scope"). An interactive Opus session gets no Opus rule at all. Sonnet and Haiku get `verify-changes` only once they edit a code file that git tracks (`presets/claude/SOURCES.md`, rules table and "Detecting a scope"). To get the rest, someone has to set `NOONSIGHT_SCOPE` or flag unattended runs.
5. **The measured effects on behaviour are narrow and cost money.** `verify-changes` made Sonnet and Haiku run tests after a one-file fix (from 0 of 30 to 29 of 30 and 27 of 30). It also roughly doubled Sonnet's cost on that task ($0.024 to $0.0505, R3, R6). Sonnet's `carry-through` helped on one backlog task (9 to 32 of 40). Most other rules showed nothing or were inconclusive, every run passed its hidden check with or without rules (R8), and the tasks were small.
6. **It's an early release.** Version 0.1 isn't on npm, so you install it from a git clone with `npm link`. `noonsight install` writes hooks into every Claude Code login on your account.

**Conditions and risks**

- **Claude Code version:** all delivery numbers come from Claude Code 2.1.328, and behaviour depends on undocumented hook timing. Pin your version, or rerun `npm run delivery -- corpus` and `npm run test:live` before each upgrade (`docs/verification/claude-code.md`).
- **Recent fixes are untested at scale:** the 99.5% rate (3,199 of 3,216 requests; 3 of 300 sessions failed) was measured before fixes F3 and F4. Those two fixes have been checked only on their own minimal reproductions, not rerun on the 300 random sessions.
- **The F4 fix may not hold:** it copies one observed Claude Code behaviour (resuming after `/model haiku` runs Haiku) whose cause the authors say "is not established". If Claude Code changes it, a session can carry the wrong model's rules until it ends.
- **Untested paths:** forks, plan mode, agent teams, `/resume` inside a session, project configs, routing, the classifier, and subagents that edit files.
- **A known gap:** a conversation compacted with no response since, then resumed without naming a model, gets the wrong rules.
- **The log can disagree with reality:** `noonsight report` records what the hook returned, not what reached the model. In the benchmark, 100% delivery by the log was 99.4% by what was actually sent (S4).
- **Keep routing off:** it ships off. If turned on in auto mode, any subagent call it changes gets the other calls in that response refused until Claude makes them again (`docs/hooks.md`).
- **Fable costs:** routing can move tasks to Fable, which may bill to usage credits.
- **Model upgrades:** a new model version gets no rules until the preset adds it. You'll see a warning, but delivery quietly stops being useful until then.
- **Overhead:** each hook takes about 60–120 ms of CPU, and each rule costs tokens. Use `noonsight report` to drop rules that never change anything you can see.
- **Pilot plan:** a few people, plus your unattended and subagent-heavy workflows. Give tasks a scope, check `noonsight report`, and compare cost and outcomes before wider adoption.

**What it guarantees**

It guarantees that each session and subagent is handed the rules written for the model it actually runs on, not that the model follows them. That rests on one fuzz benchmark run against a fake API on Claude Code 2.1.328 (99.5% of requests, measured before the latest fixes), on hook behaviours the authors checked by hand on specific versions, and on the authors' own resolver as the reference for which rules are "right".
