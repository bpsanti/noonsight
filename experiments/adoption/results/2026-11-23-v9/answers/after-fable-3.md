**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines, not a team-wide rollout. I read the docs, the evidence map, the hook definitions and the committed results, but could not run the tests or benchmarks from this session.

**Reasons**

- **It fits your setup.** The gap it closes is subagents: in its benchmark a user `CLAUDE.md` reached every main-conversation request but only 46.9% (60 of 128) of subagent requests, against 763 of 763 under noonsight. A `CLAUDE.md` also gives every model the other models' rules.
- **No quality gain is shown.** The rules changed behaviour on small tasks (Sonnet ran tests after a fix in 29 of 30 runs against 0 of 30), but every run passed its hidden check with or without rules. The paid pilot passed 133 of 144 without rules and 132 of 144 with noonsight, at about 7% more cost ($0.155 against $0.145 per run).
- **The default preset does little for half your models.** Attended Opus and Fable sessions receive nothing until you enable rules, and no Opus rule has a measured effect. Scoped preset rules never reach subagents by default, because the preset's scopes have no match patterns.
- **It is very young.** It is version 0.1.0 from a single author, and the evidence is about a week old. Nine delivery failures were found and fixed between 19 and 23 November.
- **The operational risk is low.** The hooks always exit 0 and never block a call. There are no runtime dependencies, and I found no network code in `src/`, only local calls to `ps`, `git` and `claude`. `noonsight uninstall` or `NOONSIGHT_DISABLE=1` removes it.

**Conditions and risks**

- **Pin Claude Code versions.** Delivery was measured on 2.1.330 only, and several mechanisms rely on undocumented Claude Code behaviour. Rerun the delivery corpus (a few minutes, no login or tokens) before each Claude Code upgrade.
- **Write your own rules.** The value for you is your rules per model and for subagents, not the preset. A rule of your own has no measured effect until you measure it.
- **Keep routing and the classifier off.** Neither is measured. Routing rewrites agent calls, which in auto mode gets the other calls of that response refused. The classifier sends the first 4,000 characters of a task to a model through your login.
- **Check your subagent types against the known gaps.** Workflow agents get nothing, split-pane agent teams are untested, and subagents from organization-synced plugins get their parent model's rules. On Bedrock, Vertex or Foundry, model aliases produce a warning unless pinned.
- **Treat the 100% figure as narrower than it reads.** The correctness reference is noonsight's own resolver, so a wrong resolution would not show. The run was one seed on one macOS laptop with preset rules only, and its self-check caught 4 of 9 and 7 of 15 sessions exposed to two planted bugs.
- **Review the published package before installing.** This directory has no built `dist/`, and I could not confirm the npm package matches this source.
- **Set an exit test.** Use `noonsight report` and your own task outcomes after a few weeks; drop it if nothing visible changes.

**What it guarantees:** noonsight guarantees delivery, not obedience: the rules declared for a model are placed in the requests of each session and subagent running on it, and again after a model switch, compaction, clear, resume or fork. That rests on Claude Code's hook behaviour as measured on version 2.1.330 against a stand-in API, within the documented limits.
