**Verdict: adopt with conditions.** Pilot it first, don't roll it out team-wide yet.

**Reasons**

- **It solves a real problem for your setup.** Your sessions run on Opus, Sonnet, Haiku and Fable, and many start subagents. Anthropic's prompting guidance differs by model, and noonsight delivers rules per model, including to subagents and after a model switch. Its own docs say to skip it when every session runs one model with fixed rules (README, "Using it well"). Your team doesn't fit that case.
- **Delivery is the best-measured part.** In real interactive Claude Code 2.1.330 sessions against a stand-in API, 0 of 299 sessions broke the invariant. 3,090 of 3,090 requests that were due rules held them, and 763 of 763 subagent requests did (D18–D20). The native alternatives scored lower: a user `CLAUDE.md` 88.2% (508 of 576) overall and 46.9% (60 of 128) for subagents, `.claude/rules` 76.3% (441 of 578) overall and 46.9% for subagents, and per-model skills 0% (D25–D29). A `CLAUDE.md` also puts other models' rules in 619 requests with no note retiring them, against 0 for noonsight (D32).
- **The evidence is checkable.** `npm test` recomputes each README number from the raw result files. It also records the nine failures found and fixed along the way, and it states its limits plainly.
- **Some rules measurably change behavior, cheaply.** `verify-changes` made Sonnet run the tests after its last edit in 29 of 30 runs, against 0 of 30 without it. The same rule did so for Haiku in 27 of 30, against 0 of 30. `carry-through` took Sonnet from 9 to 32 of 40 on a 13-ticket backlog task. The costs were small in absolute terms: Sonnet fix runs went from $0.0240 to $0.0505 with `verify-changes` alone.
- **The risk surface is small.** It has no runtime dependencies, it is MIT licensed, its hooks never block anything, and it reads only local files. The one network use is the optional classifier, which is off by default. `NOONSIGHT_DISABLE=1` and `noonsight uninstall` back it out.

**Conditions and risks**

- **No quality gain is shown.** Every run passed its hidden check with or without rules (600 of 600). In the paid pilot on public tasks, 133 of 144 runs passed without rules, 132 of 144 under noonsight, and 133 of 144 with a `CLAUDE.md`. The pilot ran on 2.1.326 and delivered to the main conversation only. The benefit is process behavior (tests run, tasks completed), not better outcomes. Adopt only if you value those behaviors.
- **The preset does little out of the box for attended sessions.** Opus's and Fable's attended rules ship off. Sonnet and Haiku get most of their rules only with a scope or after an edit to a tracked code file. Plan to set `NOONSIGHT_SCOPE`, write your own rules, and set `session.unattended_when_env` for interactive sessions nobody is watching.
- **Opus has no measured rule effect.** Fable has one (`low-context-report`), and it was measured on 2.1.328. The Opus preset rules are taken from Anthropic's guide, not measured. Any rule you write yourself has no measured effect until you test it.
- **Delivery is not obedience.** A delivered rule is context, the same as `CLAUDE.md`.
- **Known gaps matter for subagent-heavy teams:**
  - A workflow's agents get nothing.
  - Foreground subagents of one type that need different rules get nothing until their first Edit, Write or agent call.
  - A plugin noonsight doesn't read, such as one an organization syncs, leaves its subagents predicted on their parent's model.
  - A conversation compacted with no response since, then resumed with no model named, runs on Claude Code's default model, which noonsight can't detect.
  - Agent teams, routing and the classifier are unmeasured.
  - `/fork` is unavailable in sessions started with `noonsight run` that have rules.
- **It is tied to the Claude Code version.** The delivery results hold for 2.1.330 and the rule-effect results for 2.1.329, apart from Fable's (2.1.328). Hooks can change in any update. Pin Claude Code for the pilot and re-run `noonsight check` and `noonsight report` after each upgrade.
- **The project is young and has a single maintainer.** The version is 0.1.0 and the author is one person. It was renamed from "sextant" recently. Some findings are only days old (runs dated 2026-11-16 to 2026-11-23), and the project has no track record of keeping up with Claude Code releases. Review the code and the hooks before installing, because `noonsight install` edits the hooks of every Claude Code login on the account. I read the docs, not the source. Install through npm (`npm install -g noonsight`) rather than `npx`, which runs from npm's cache and stops delivering rules if the cache is cleared.
- **Cost:** about 1,343 characters added per request, against 3,889 to 4,472 for the `CLAUDE.md` and `.claude/rules` setups (D31). Each hook run takes roughly 80 to 150 ms of processor time (D33), measured on a loaded laptop.
- **Rules cost more tokens.** The README's own table shows Sonnet cost per run going up by about 1.4 to 2 times in some tasks.

**Suggested pilot:** use 2–3 people for 2 weeks on one pinned Claude Code version. Review the source first. Run `noonsight check`, then `noonsight report` weekly to see which rules were delivered and which never were. Drop rules that change nothing you can see. Adopt more widely only if the subagent gaps above don't hit your workflows.

**What it guarantees:** Through Claude Code's hooks, noonsight puts the rules declared for a model into the requests of each session and subagent running on it, including after model changes, compaction, clear, resume and fork. That is delivery, not obedience, and it rests on a local benchmark of real Claude Code 2.1.330 sessions run against a stand-in API, with the known gaps above.
