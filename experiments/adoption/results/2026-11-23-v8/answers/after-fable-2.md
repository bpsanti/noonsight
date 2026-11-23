**Verdict:** adopt with conditions — as a pinned pilot on a few machines, not a team-wide rollout yet.

I read the docs, the evidence map, the current benchmark results and the preset, but could not run the tests or the tool in this session. The headline delivery numbers in the README match the committed `summary.json`.

**Reasons:**

- **It fits your setup.** It hands each session and subagent the rules for the model it actually runs on, and re-delivers after `/model`, `/compact`, `/clear`, resumes and forks.
- **Subagents are where it beats what you have.** In its benchmark, a `CLAUDE.md` reached 100% of the main conversation's requests (448 of 448) but only 46.9% of subagent requests (60 of 128), because it never reaches Explore and Plan. noonsight reached 763 of 763.
- **The delivery claim is well supported.** In the current run, 0 of 299 completed sessions broke the invariant, and 3,090 of 3,090 requests held their rules.
- **Delivery is not better outcomes.** On public tasks the paid pilot passed 133, 132 and 133 of 144 runs with no rules, noonsight and a `CLAUDE.md`, at $0.145, $0.155 and $0.173 per run.
- **The measured rule effects are narrow.** Three preset rules show an effect, on small tasks with 30 to 40 runs per arm: `verify-changes` on Sonnet and Haiku, `carry-through` on Sonnet, and `low-context-report` on Fable. No Opus rule has a measured effect, and `verify-changes` about doubles the cost of a small fix ($0.0240 to $0.0505 on Sonnet).
- **Out of the box, your attended Opus and Fable sessions get nothing.** Their attended preset rules ship off; the value there comes from rules you write yourselves.
- **It is very young.** `package.json` says 0.0.1 and private, it is not on npm, and it was recently renamed. The benchmark found nine delivery failures (F1 to F9), all fixed before the current run, which is dated today.
- **It is low-risk to try.** There are no runtime dependencies, I found no network code in `src`, the hooks always exit 0 and never block a call, and `noonsight uninstall` removes them.

**Conditions and risks:**

- **Pin Claude Code.** The claim is measured on 2.1.330 only, and several behaviours it relies on are undocumented by Claude Code (fork detection, the headless flag, subagent metadata). Re-run its corpus (`npm run delivery -- corpus`, no login or tokens needed) before each Claude Code upgrade.
- **Install from a pinned commit of the clone.** Do not use `npx noonsight`: the npm name currently holds an empty placeholder.
- **Have rules worth delivering.** If you have nothing that differs by model, a `CLAUDE.md` is simpler, and the README says so itself.
- **Failures are silent.** A refused configuration or an untrusted repository delivers nothing, with only a warning. Make `noonsight check` and `noonsight report` part of the routine.
- **Check your organization's settings.** `allowManagedHooksOnly` or `disableAllHooks` in managed settings stops the per-account install.
- **Subagent gaps remain.** Workflow agents get nothing, agent teams are unmeasured, and subagents from organization-synced plugins are predicted on the parent's model. Subagents only get scoped rules if you write `match` patterns or turn on the classifier, which sends task text to a model.
- **The benchmark has blind spots.** It uses a stub API, one seed and one macOS laptop, and its reference is noonsight's own resolver, so a wrong resolution would not show. Its self-check caught only 4 of 9 and 7 of 15 exposed sessions for two of the three planted bugs.
- **Other costs.** Windows is unsupported. Each hook run costs 80 to 150 ms of CPU on a loaded machine, and the rules add about 336 tokens per request.

**What it guarantees:** noonsight guarantees that the text of the rules you declared for a model is in the requests that model receives, and not that the model obeys them. That rests on one stub-API benchmark run of 299 sessions on Claude Code 2.1.330.
