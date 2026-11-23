Verdict: adopt with conditions. Run it as a pilot on one version of Claude Code, with your own rules, not as a drop-in.

I read the README, `docs/evidence.md`, `docs/hooks.md` and `docs/verification/claude-code.md`. I did not run `npm test` or the benchmarks, so every number below is the project's own claim, which it says its tests recompute from committed raw files.

**Reasons**
- **It fixes a gap you have.** Your sessions span four models and start subagents. A user `CLAUDE.md` reached only 32.2% of subagent requests (39 of 121) and never reached the built-in Explore and Plan subagents. noonsight reached 100% of subagent requests (668 of 668, then 763 of 763) (D3, D10, D20).
- **It is built for model changes.** `/model`, `/compact`, `/clear`, resumes and forks all redeliver the right rules. Later runs added `/fork`, `/resume`, plan mode and subagents that edit files, and covered all of them (D18, D21). It also tells the model that the previous model's rules no longer apply.
- **The hooks are low-risk.** They never block anything, always exit 0, use no network (except the optional classifier, which is off by default) and take 50 to 90 ms of CPU each (D15). `NOONSIGHT_DISABLE=1` and `noonsight uninstall` back it out.
- **It is auditable.** Every decision goes to `decisions.jsonl`, and `noonsight report`, `resolve` and `check` let you see what each model received.
- **The evidence is unusually careful.** Every number in the README maps to a raw file. The project found and fixed nine of its own failures (F1 to F9) and kept their reproductions as a regression corpus. The README says plainly what it does not guarantee.

**Conditions and risks**
- **The delivery tests ran against a local stand-in for the API.** No real model received any request, so delivery is verified, not behaviour. Delivery is also not obedience: a delivered rule is context, and Claude Code says the same of `CLAUDE.md`.
- **The preset does little for Opus and Fable in interactive sessions.** Their attended rules ship off, so those sessions receive nothing from the preset until you run `enable` or write your own rules. The value for you is mostly in your own rules, which have no measured effect until you measure them.
- **Rules need scopes and the right place setting.** Sonnet and Haiku scoped rules need `NOONSIGHT_SCOPE`. Set `session.unattended_when_env` for interactive sessions nobody is watching, or they are treated as attended.
- **The preset's measured effects are narrow.** They come from small tasks with 30 to 40 runs per arm. `verify-changes` doubled Sonnet's cost on the fix task ($0.0240 to $0.0505, R6), and Haiku's `carry-through` showed no effect (R11). Check each rule's cost and effect before turning it on.
- **It depends on undocumented Claude Code behaviour.** That includes `CLAUDE_CODE_SESSION_ATTENDED`, fork internals, transcript layout and `/fork` job files. It was verified on 2.1.325 to 2.1.330 only. Pin your Claude Code version, rerun `npm run test:live` on each upgrade, and expect silent degradation if a release changes a hook.
- **Known holes that matter for you:**
  - Workflow agents get nothing.
  - Foreground subagent calls of one type that need different rules get nothing until the subagent's first Edit, Write or agent call.
  - Agent teams in split panes were not checked.
  - Plugins noonsight cannot read, such as ones an organization syncs, leave their subagents predicted on the parent's model.
  - A compacted conversation resumed with no model named runs on Claude Code's default model, which noonsight cannot tell.
  - `/fork` is unavailable in `noonsight run` sessions that have rules.
- **It is early and small.** It is version 0.1, not on npm, and installs from a git clone. The `bpsanti/noonsight` repository is the only source named, and it is not a vendor-supported tool. The hooks run on every session of every account, so someone on your team has to own upgrades and review the code.
- **Security:** `noonsight trust` is required before a repository's own `.noonsight/noonsight.json` takes effect, which stops a cloned repo from injecting rules. Make that part of your onboarding.
- **Ongoing cost:** if you use `PostModelSwitch`-heavy workflows, the redelivered rules and notes add context (about 1,155 characters per request on average in the benchmark, D13).

Suggested pilot: install on two or three people's logins, write two or three team rules, and check `noonsight report` after a week. Skip it if everyone runs one model, since a `CLAUDE.md` is then simpler (the project says so too).

**What it guarantees**
It guarantees that a session or subagent receives the rules written for the model it runs on (99.9% of due requests in the first benchmark, 100% of 3,090 in the later one, with the one-in-300 failing session being a documented limit), and that guarantee rests on Claude Code's hooks, version-pinned and partly undocumented, tested against a local stand-in for the API, not on any model following the rules.
