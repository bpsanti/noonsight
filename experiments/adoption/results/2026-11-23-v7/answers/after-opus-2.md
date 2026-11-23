**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines first, not as a team-wide default.

**Reasons**

1. **It covers the gap you have.** Your team mixes models and uses many subagents, and that's where the built-in options fail. On the same 60 benchmark sessions, a user `CLAUDE.md` reached 100% of the main conversation's requests but only 32.2% of subagent requests (39 of 121). It never reaches the built-in Explore and Plan subagents. It also gives every model every other model's rules: only 31.5% of the rule text in a request was meant for that model, against 79.0% under noonsight. Under noonsight, subagent coverage was 100% (`docs/evidence.md` D6–D12, D17).
2. **The evidence is unusually careful.** Every number links to a raw result file, and `npm test` recomputes it (`docs/evidence.md:5`). The benchmark drives real interactive Claude Code sessions against a local stand-in for the API, through `/model`, `/compact`, `/clear`, resumes, forks, plan mode and subagents. It shrinks each failure to a short reproduction and keeps it in a test corpus. It also checks itself by planting bugs and confirming it catches them. Latest run, Claude Code 2.1.330, 2026-11-23: 0 of 299 sessions broke its rule, and 3,090 of 3,090 requests that were due rules got them.
3. **Failure is mild.** The hooks always exit 0, never block or deny anything, read only local files and use no network. The one exception is the optional classifier, which is off by default. A config with any problem is refused as a whole and you get a warning (`docs/hooks.md:9-24`). The worst case is a request with missing or wrong-model rules, which is close to where you are now. Cost is about 50–150 ms of CPU per hook and about 1,155 characters per request, against about 4,400 for an every-model `CLAUDE.md`.
4. **It's young, and new paths keep turning up bugs.** It's version 0.1, not on npm, and installed from a clone. The fuzzer found nine failures in about a week. Five of them (F5–F9) came from the paths added in the newest run, and those fixes were measured today. CI still pins Claude Code 2.1.325, while the latest results are on 2.1.330.
5. **The shipped rules do little on their own for half your models.** Opus 5.5 and Fable 5.2 sessions that someone is watching get nothing from the preset until you turn rules on. Sonnet and Haiku get `verify-changes` only after they edit a tracked code file (README:47-53). Most of the value has to come from rules you write.
6. **The measured effect of the rules is narrow and costs money.** `verify-changes` strongly increased running tests after edits, but it about doubled Sonnet's cost on that task ($0.0240 to $0.0505). Haiku's `carry-through` showed no effect. Opus 5.5 wasn't in the rule-effect experiment. The samples are 30–40 runs on small tasks (R1–R13).

**Conditions and risks**

Conditions:
- You have rules that really differ by model or by kind of task. If they don't, the README itself says a `CLAUDE.md` is simpler.
- Pin a reviewed noonsight commit and your Claude Code version together. Rerun its corpus (`npm run delivery -- corpus`) before upgrading either. `docs/verification/claude-code.md` lists about 70 Claude Code behaviours it depends on, some undocumented. For example, it uses `CLAUDE_CODE_SESSION_ATTENDED` to tell headless runs apart, and if that variable is dropped every session counts as watched.
- Your organization's managed settings must not set `allowManagedHooksOnly` or `disableAllHooks`. If you use server-managed settings (Team/Enterprise), use the per-account install, because those settings make Claude Code ignore the machine-wide `--managed` hooks.
- Set `session.unattended_when_env` for interactive sessions nobody watches. Set `NOONSIGHT_SCOPE` if you want rules that depend on the kind of task.
- Leave routing and the classifier off. Neither has been measured. In auto mode, routing makes Claude Code refuse the other agent calls in the same response.
- Review the code before installing. `noonsight install` adds hooks to every Claude Code login on the account.
- Check with `noonsight report`, and drop rules that don't change anything you can see.

Known gaps that may affect you:
- A workflow's agents get no rules.
- Agent teams are unmeasured. Teammates in split panes, which run in their own process, were never checked.
- Subagents from plugins it doesn't read, such as ones your organization syncs, are assumed to run on their parent's model, so they may get the wrong model's rules.
- It can't tell which model `default` and `opusplan` select. Without the pinning environment variables, Bedrock, Vertex and Foundry aliases give a warning instead of rules.
- `/fork` doesn't work in sessions started through `noonsight run`.
- A conversation compacted and then resumed with nothing naming a model can get the wrong model's rules.

**What it guarantees:** On the Claude Code version it was last measured on, each request from a session or subagent carries the rules your configuration gives the model it actually runs on, and any other model's rules are marked as no longer applying. That rests on stub-driven benchmarks (no real model reads anything), on Claude Code hook behaviours rechecked by hand for each version, and on noonsight's own rule resolver serving as the reference, so a wrong resolution wouldn't show up. It promises nothing about whether the model follows the rules.

I reviewed the docs, the benchmark write-ups and the evidence map, but I didn't run the tests or check the raw result files myself.
