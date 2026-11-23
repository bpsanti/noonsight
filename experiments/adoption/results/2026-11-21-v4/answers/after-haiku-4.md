**Verdict: adopt with conditions.** Pilot it on the team's subagent-heavy workflows first, and don't roll it out to every session until the conditions below hold.

**Reasons**

1. Your team's pattern is the one it targets. Subagents are where it helps most. In its 300-session benchmark, subagent requests carried their model's rules 100% of the time (D9), against 32.2% for a user `CLAUDE.md` (D10) and 0% for skills (D11). Explore and Plan subagents never see a `CLAUDE.md` (S4), so any team that relies on them is probably missing rules today.
2. It handles mixed models per request. A `CLAUDE.md` gives every model every other model's rules. Under noonsight, 79.0% of rule text in a request was written for that request's model, against 31.5% for `CLAUDE.md` (D12). That matters if Opus, Fable, Sonnet and Haiku sessions share one configuration.
3. It re-delivers rules after `/model`, `/compact`, `/clear` and resumes, and retires the previous model's rules. The fuzzer found four real failures (F1 to F4), all fixed before the final run, and the reproductions are in its corpus.
4. It is local and light. The hooks use no network, don't block anything, and run in roughly 50 to 90 ms of CPU per hook (D15). The only network path is the classifier, which is off by default.
5. Rule effects are measured, but only for the preset's rules and only on small tasks. `verify-changes` moved Sonnet and Haiku from 0 of 30 to 27–29 of 30 runs running tests after a one-file fix. The `carry-through` rule raised Sonnet's full-completion rate on a 13-ticket backlog from 9 of 40 to 32 of 40. Haiku's `carry-through` showed no effect there (R3, R10, R11).

**Conditions and risks**

- **Watched Opus and Fable sessions get nothing from the preset.** Every shipped rule for those models is for unattended runs or subagents. Either set `session.unattended_when_env` to a variable your team's orchestrator or CI sets, or write your own rules for those models. Otherwise your interactive Opus and Fable sessions will look as if noonsight is installed when it delivers nothing.
- **Sonnet and Haiku need a scope for most rules.** Without `NOONSIGHT_SCOPE` or `noonsight run --scope`, a watched session gets only `verify-changes`, and only after it edits a tracked code file. Decide whether your team will set scopes, or whether that gap is acceptable.
- **Repository configuration was not benchmarked.** The shared `.noonsight/noonsight.json` is the likely way your team will share rules, and the benchmark did not measure it. Each developer must run `noonsight trust` once per clone. Test it on one repo before relying on it.
- **Not measured:** subagents that edit files, `/resume` inside a session, forks, plan mode, agent teams, `noonsight run`, and routing. If your team uses agent teams or subagents that write code, check those paths yourselves with `noonsight report`.
- **Version dependence.** The benchmark covers only Claude Code 2.1.328 and a stub API, so no request reached a real model. The hooks also rely on `CLAUDE_CODE_SESSION_ATTENDED`, which Claude Code does not document. Re-run `npm run delivery` after each Claude Code upgrade.
- **Delivery is not obedience.** A delivered rule is context, not enforcement. Rules that must never be broken belong in hooks or permission rules.
- **Install is from a clone.** The npm package is only a placeholder for now, so each developer would build from source. Plan for that, or wait for 0.1.
- **Self-reported evidence.** The benchmark, experiments and README claims were all produced by the project's author. A separate experiment that asked fresh sessions to judge adoption had the rewritten README at 8 of 12 grounded answers, short of its own bar. Treat the docs as useful but not authoritative, and check numbers against the committed result files.
- **Cost.** Each rule adds characters to every request it reaches. On the one measured case, a run cost about double with `verify-changes` ($0.0240 to $0.0505). Use `noonsight report` to find rules that never change anything.

**What it guarantees:** Each session and subagent receives the rules written for the model it runs on, for its place and scope, and receives them again after a model change, with the previous model's rules retired. The evidence is the stub-API benchmark on Claude Code 2.1.328 (99.9% of requests with rules due covered, 1 of 300 sessions broke the invariant at a documented limit), and it rests on Claude Code's hook events, the stub harness, and the project's own checks; it does not guarantee that the model follows the rules.

I did not install the tool or run its test suite; this rests on reading the README, changelog, usage and benchmark docs.
