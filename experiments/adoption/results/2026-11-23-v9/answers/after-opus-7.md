**Verdict: adopt with conditions.** Run it as a time-boxed pilot on part of the team, not as a team-wide rollout yet.

**Reasons**

- **It addresses a real gap in your setup.** You use four models and lots of subagents, and that is the case this tool is built for. On Claude Code 2.1.330, a user `CLAUDE.md` reached only 46.9% (60 of 128) of subagent requests. It also put other models' rules, unmarked, into 619 requests, and only 32.6% of the rule text in a request was meant for that request's model. noonsight reached 100% (763 of 763) of subagent requests and put another model's rules unmarked into none (`docs/evidence.md` D28, D30, D32, D20). It also reaches the built-in Explore and Plan subagents, which `CLAUDE.md` never does.
- **The delivery claims are well supported.** It tested 300 real interactive sessions, including forks, resumes, plan mode and subagents. Every number points to a committed raw file, and `test/evidence.test.ts` recomputes each one from that file.
- **But nothing shows the work gets better.** On public tasks, 133, 132 and 133 of 144 runs passed with no rules, with noonsight and with a `CLAUDE.md` (B1). In the controlled runs, 600 of 600 passed their checks with or without rules (R8). The measured effects are process habits on small tasks: Sonnet and Haiku ran the tests more often, Sonnet finished more of a backlog, and Fable wrote shorter sentences in its reports. None of the Opus 5.5 rules has a measured effect, and those rules cost money: `verify-changes` roughly doubled Sonnet's cost per run on the one-file fix ($0.0505 against $0.0240).
- **Out of the box it delivers little to Opus and Fable.** Their rules for sessions someone is watching ship turned off, so your interactive Opus and Fable sessions get nothing from the preset until you turn rules on or write your own.
- **It is very new.** It is version 0.1.0, and all its history falls between 2026-11-14 and 2026-11-23. In that time the benchmark found nine delivery bugs (F1 to F9), all fixed. That shows good testing, and also that the code hasn't settled.

**Conditions and risks**

What would have to hold:
- **Your Claude Code version must match what was tested.** Delivery was measured on 2.1.330 only. Pin that version during the pilot, and re-run `noonsight check` after each Claude Code update.
- **Sessions must name their model.** It can't tell which model the `default` and `opusplan` settings select, and it doesn't read a model set only in an MDM profile. On Bedrock or Vertex, aliases like `sonnet` need the `ANTHROPIC_DEFAULT_*_MODEL` variables set, or you only get warnings.
- **Set `session.unattended_when_env`** for any orchestrated interactive sessions. Otherwise it treats them as watched and gives them the wrong rules.
- **Install it globally with npm** (`npm install -g noonsight`), not with `npx`. With `npx`, the hooks run from npm's cache and stop delivering once the cache is cleared.
- **Write and measure your own rules.** Use `noonsight resolve` to see what each model gets and `noonsight report` to confirm delivery. Drop any rule you can't see changing anything.

What could go wrong:
- **Some agents get nothing:** workflow agents, organization-synced plugins it doesn't read, and parallel subagent calls of one type that need different rules (those wait until the subagent's first Edit, Write or agent call, or get nothing if it makes none). Agent-team teammates in split panes were never checked.
- **The tests don't cover every case.** Agent teams, routing and the classifier aren't measured. The benchmark used a stand-in API, so no model ever answered, and it checked delivery against noonsight's own rule resolver, so a wrong rule choice wouldn't show up as a failure.
- **A future Claude Code release could quietly break delivery.** The log records what the hooks sent to Claude Code, not what reached the model.
- **Costs and side effects:**
  - Each hook takes about 80 to 150 ms of processor time.
  - `noonsight install` edits the settings of every Claude Code login on the account.
  - `/fork` doesn't work in sessions started with `noonsight run` with rules.
  - Each person has to run `noonsight trust` before a repository's rules apply.

**What it guarantees:** It guarantees delivery, not obedience: each session and subagent gets the rules for the model it runs on, again after a model change, compaction, clear, resume or fork, apart from the limits above. That rests on Claude Code's hook behaviour as observed on 2.1.330, on noonsight correctly predicting each subagent's model the way Claude Code chooses it, and on a stand-in-API benchmark of 299 sessions that broke delivery in none of them.
