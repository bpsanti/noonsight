**Verdict: adopt with conditions.** Pilot it on a few people's machines first, and make the conditions below part of the rollout.

**Reasons**

- It fits the team's mix of models. It picks rules by model, scope, place and trigger, so Opus, Sonnet, Haiku and Fable sessions each get their own rules, and it re-delivers them when the model changes. Without it, you would have to hand-maintain one `CLAUDE.md` or `.claude/rules` set per model.
- Subagent coverage is the main reason to adopt. The README's comparison table shows that a user `CLAUDE.md` reached 46.9% (60 of 128) of subagent requests in its test, while noonsight reached 100% (763 of 763) under the same design (D20). Your many subagent-heavy sessions are where the native mechanisms fall short.
- The delivery numbers check out. I opened `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`. The `on-g2-s1-n300` entry shows 300 sessions, 299 ran to the end, and `due` and `covered` are both 3,090 (D18, D19). The benchmark drove real interactive Claude Code sessions against a local stub of the Messages API, so the delivery is measured but no model's behavior is.
- It fails open, so it cannot block your work. The hooks never deny a call, and it has a `report` command that lists what was delivered and to which models, scopes and places.
- Its own limits are documented and specific. The README and `docs/hooks.md` list them, which makes it easier to plan around them.

**Conditions and risks**

- **Delivery is not behavior.** Rule effects are measured only on small tasks, with 30 runs per arm. `verify-changes` alone moved Sonnet 5.5 on a fix task from 0 of 30 to 29 of 30 passing tests, and cost went from $0.024 to $0.051 per run. No quality gain was shown on the pilot's public tasks (133 of 144 without rules, 132 of 144 under noonsight). Budget for the cost increase and measure the rules you rely on.
- **Known subagent gaps that matter to you.** A workflow's agents get no rules. Foreground calls of one type that need different rules give their subagents nothing until their first Edit, Write or agent call. Subagents of plugins it cannot read stay predicted on the parent's model. Agent teams, routing and the classifier are not measured.
- **Preset defaults may leave interactive sessions with no rules.** Opus 5.5's and Fable 5.2's attended rules ship off, and Sonnet and Haiku only get their scoped rules when a scope is set. Someone must choose these settings, or the team gets less than expected.
- **Set `session.unattended_when_env`** to your CI or orchestrator variable, or unwatched interactive sessions are treated as attended.
- **Version sensitivity.** Results were measured on Claude Code 2.1.330, with some on 2.1.328 and 2.1.329. Pin the Claude Code version the team uses and re-run `noonsight report` after each upgrade.
- **Installation touches every login.** `npm install -g noonsight` followed by `noonsight install` adds hooks to every Claude Code login on the account. Pilot it on a few machines first. `noonsight uninstall` reverses it.
- **Project rules are context injected into the model.** A repo's `.noonsight/noonsight.json` changes nothing until someone runs `noonsight trust`. Review those rule files as you would review any prompt that will run with your agents, and keep the trust step in your onboarding.
- **Off-machine data flow.** The classifier, off by default, sends the first 4,000 characters of a task to a small model through each person's Claude Code login. Keep it off unless you have reviewed that.
- **Single-maintainer project.** I saw one maintainer and one repository, and the evidence is produced by the same project's own harness. Pin a version and read the changelog before upgrading.
- **What I did not do.** I did not run the tool or its test suite, and I did not audit its hook code. My conclusions come from the README, the docs, and the summary numbers I checked.

**What it guarantees:** Through Claude Code's hooks, noonsight puts the rules declared for a model into the context of each session and subagent running on that model, and re-delivers them on a model change, compaction, resume or fork; this rests on hook-based delivery measured on Claude Code 2.1.330 (0 of 299 sessions broke the invariant, and 3,090 of 3,090 due requests were covered), and it guarantees delivery only, not that the model follows the rules.
