**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a pinned Claude Code version. Don't roll it out team-wide yet.

**Reasons**

- **It fits how you work.** You run four models and many subagents, and that is the case this tool is for. The repo's own measurements show what plain `CLAUDE.md` misses:
  - **Subagents:** a `CLAUDE.md` reached 32.2% of subagent requests, against 100% for noonsight (D9, D10). Claude Code's docs say `CLAUDE.md` never reaches the built-in Explore and Plan subagents.
  - **Mixed rules:** with a `CLAUDE.md`, only 31.5% of the rule text in a request was written for that request's model. Under noonsight it was 79.0% (D12).
  - **Main conversation:** here a `CLAUDE.md` already reached 100% of requests, through `/model`, `/compact`, `/clear` and resumes (D17). So the gain is in subagents and in not mixing models' rules.
- **The delivery evidence is unusually careful.** It comes from 300 fuzzed real Claude Code sessions per run. The tests recompute every published number from committed raw files, and the fuzzer is checked against failures planted on purpose. On Claude Code 2.1.330, 0 of 300 sessions broke the "right rules, and only those" check, with 3,090 of 3,090 requests covered (D18, D19).
- **The project is very new.** Every changelog entry and result dates from 2026-11-14 to 11-23. Version 0.1 isn't on npm yet, so you install it from a git clone. It looks like a one-person repo (`bpsanti`). The fuzzer found nine real delivery bugs (F1–F9) in about a week, and all of them are fixed. That speaks well of the testing, but it also shows how easily this can break.
- **It depends on Claude Code internals that could change without notice.** Several fixes rely on undocumented behaviour, checked only on 2.1.330: the `CLAUDE_CODE_SESSION_ATTENDED` variable, `forkedFrom` entries in transcripts, the `/fork` job's `state.json`, and subagent `.meta.json` files. CI's live tests are still pinned to Claude Code 2.1.325 (`.github/workflows/ci.yml:41`).
- **The default rule set does little in watched sessions.** An attended Opus 5.5 or Fable 5.2 session gets nothing from the default rules. Attended Sonnet and Haiku sessions get `verify-changes` once they edit tracked code, plus other rules only if you set a scope. Most of the value has to come from rules you write yourselves.
- **The measured effects of the rules are narrow and cost money.** On a small one-file fix, `verify-changes` made Sonnet and Haiku run the tests in 29/30 and 27/30 runs, against 0/30 without rules. It also roughly doubled Sonnet's cost on that task ($0.0240 → $0.0505). Where models already did the work, the rules changed nothing and still cost a little. The tasks were small, so treat these as results on those tasks, not general effects.

**Conditions and risks**

Conditions:
- Pin your Claude Code version. On each upgrade, run the regression set of known-tricky sequences (`npm run delivery -- corpus`) before letting anyone move to the new version.
- Build from a specific commit you've reviewed. Note that `noonsight install` adds hooks to every Claude Code configuration directory under your home directory.
- Write your own per-model rules for the differences you actually care about. Keep shared rules in `CLAUDE.md`.
- If you have orchestrators or unwatched sessions, set `session.unattended_when_env` so they get the unattended rules.
- Check `noonsight report` regularly, and measure whether your own rules change anything. None of your rules has a measured effect until you test it.
- Keep the classifier off. Then it stays fully local; when on, it sends the first 4,000 characters of a task to a model.

Risks:
- **A silent break after a Claude Code update.** The decision log records what the hooks returned, not what reached the model, so a dropped or misdirected delivery may not show up there.
- **Known gaps in coverage:**
  - Workflow agents get nothing.
  - Agent-team teammates in split panes were not checked.
  - Subagents from plugins noonsight doesn't read, such as ones your organization syncs, are assumed to run on their parent's model.
  - A forked `--continue` can pick up the wrong transcript if another session in the same project writes at the same moment.
  - A compacted conversation resumed with nothing naming a model can get the wrong rules.
  - Sessions started through `noonsight run` can't use `/fork`.
- **Several features were never measured:** agent teams, routing and the classifier.
- **Small overhead:** each hook run takes about 50–90 ms of CPU, and rules add tokens to requests.
- **The benchmark grades against noonsight's own rule picker.** If that picker chose the wrong rules, the benchmark wouldn't catch it.
- **It's a new dependency** sitting in every session's startup path, kept up by one maintainer.

**What it guarantees:** It promises delivery, not obedience: each request should carry the configured rules for the model it actually runs on, with notes retiring any other model's rules. That promise rests on hook behaviour verified only on specific Claude Code versions (2.1.328 and 2.1.330), measured against a local stand-in for the API, and could stop holding when Claude Code changes.
