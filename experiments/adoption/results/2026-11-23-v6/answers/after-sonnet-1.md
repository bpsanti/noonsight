**Verdict: adopt with conditions.** Pilot it on a few machines before rolling it out to the team.

**Reasons**
- **It fits your setup.** You run Opus, Sonnet, Haiku and Fable, and many sessions start subagents. That is the case noonsight is built for. It gives each session and each subagent the rules written for the model it actually runs on, and re-delivers them when `/model` changes the model (README).
- **The delivery claim has solid evidence behind it.** On Claude Code 2.1.330, 300 random sessions covered `/model`, `/compact`, `/clear`, resume, fork, plan mode, `noonsight run` and subagents that edit files. 0 of 300 broke the invariant, and 3,090 of 3,090 requests held their rules (D18, D19). Subagent requests were 763 of 763 (D20).
- **The failures were found and fixed in the open.** The fuzzer found nine failures of noonsight's own (F1–F9). Each has a reproduction in the corpus. Before the fixes, 8 of 8 reproductions of F5–F9 broke the invariant (D24). After them, 33 of 33 corpus entries behave as recorded (D23).
- **It beats the native options for subagents.** A user `CLAUDE.md` reached 32.2% of subagent requests, and `.claude/rules` the same. Skills reached 0% (D8, D10, D11). A `CLAUDE.md` also sends every model the other models' rules. Only 31.5% of its rule text was written for the request's model, against 79.0% under noonsight (D12).
- **It is low-risk to operate.** It never blocks anything and never uses the network, apart from the optional classifier, which is off by default. Hook cost is 50–90 ms of CPU (D15). It reads local files only and logs every delivery (`noonsight report`). `noonsight uninstall` and `NOONSIGHT_DISABLE=1` remove it or switch it off.
- **The documentation is honest about its limits.** Every number links to an evidence entry that a test recomputes. Known gaps are listed: agent teams, routing and the classifier are not measured, and workflow agents get nothing.
- **The preset has measured effects, but they are narrow.** `verify-changes` took test-running from 0 of 30 to 29 of 30 on Sonnet. `sonnet-5-5/carry-through` raised complete runs on a 13-ticket backlog from 9 of 40 to 32 of 40. The cost is about double per run on Sonnet's fix ($0.0240 to $0.0505, R6). Haiku's `carry-through` showed nothing (R11).

**Conditions and risks**
- **Immature packaging.** Version 0.1 is not on npm. You install from a clone with `npm link`, from what appears to be a single-maintainer repo (`bpsanti/noonsight`). Pin a commit, review the code that edits your `settings.json`, and decide who owns upgrades.
- **Tied to Claude Code versions.** The benchmark ran on 2.1.328 and 2.1.330. It depends on hook behaviors that Claude Code can change, and `docs/verification/claude-code.md` lists each one with the version it was checked on. One of them is `CLAUDE_CODE_SESSION_ATTENDED`, which Claude Code does not document. You would need a step to re-run `npm run test:live` on each Claude Code upgrade, ideally with a CI pin.
- **The preset does little for attended Opus and Fable sessions.** All of their attended rules ship off, so those sessions get nothing from the preset until you run `enable`. Sonnet and Haiku attended sessions get only `verify-changes` after a code edit, plus anything you scope. You will mostly be writing your own rules.
- **Your own rules have no measured effect.** The data covers the preset's rules on small tasks, with 30–40 runs per arm. Delivery is not obedience, and the README says so. Budget time to test your own rules.
- **Attended versus unattended needs setup.** Set `session.unattended_when_env` for any interactive session that nobody watches, such as CI or orchestrators. Otherwise those sessions count as attended and miss the unattended rules.
- **Known gaps in delivery.**
  - A workflow's agents get no rules.
  - Foreground subagents of one type that need different rules get nothing until their first Edit, Write or agent call.
  - Plugins that noonsight doesn't read, such as org-synced ones, leave subagents predicted on the parent's model.
  - A conversation that was compacted, then resumed with nothing naming a model, can get the wrong model's rules.
  - `/fork` doesn't work in `noonsight run` sessions that have rules.
- **Fable is billed by `npm run test:live`.** The live preset checks send real requests to all four models, Fable included. In `claude -p` these draw on usage credits without asking, on plans where Fable uses them.
- **Repo rules need a trust step.** Each person must run `noonsight trust` once per clone before a repository's `.noonsight/noonsight.json` takes effect.
- **A cheaper alternative if the gain is small.** The README says to skip noonsight when every session runs one model with fixed rules. A `CLAUDE.md` is simpler, and it reaches the session's own conversation 100% of the time (D17).

**What it guarantees:** It guarantees that each Claude Code session and subagent gets its model's configured rules, re-delivered when the model changes, on 99.9% to 100% of benchmark requests. That rests on a fuzzer run against a local stand-in for the API on Claude Code 2.1.328 and 2.1.330. No request reached a real model, so it guarantees delivery of the rules and says nothing about whether the model follows them.
