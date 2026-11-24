**Verdict:** adopt with conditions, as a time-boxed pilot on a pinned Claude Code version, not a team-wide rollout yet.

This rests on the docs, the config and the committed result files. I could not run the test suite or audit the source: there is no shell here and the checkout has no built `dist/`. The headline numbers I spot-checked in the raw `summary.json` and `agree.json` match what the README claims.

**Reasons:**
- **It fits your setup.** noonsight delivers per-model rules to each session and subagent through Claude Code hooks, and re-delivers after `/model`, compaction, clear, resume and fork. Mixed models plus heavy subagent use is the case it is built for.
- **The gap it closes is in subagents.** In its benchmark a user `CLAUDE.md` reached 100% of main-conversation requests (448 of 448) but only 46.9% of subagent requests (60 of 128). noonsight reached 763 of 763 subagent requests and 3,090 of 3,090 overall.
- **It sends less irrelevant text.** A `CLAUDE.md` holding every model's rules added about 4,472 characters per request, most of it written for other models. noonsight added about 1,343.
- **The evidence is for delivery, not better outcomes.** With rules, Sonnet and Haiku ran tests after edits far more often (30 of 30 against 0 of 30 on a small fix). But every run passed its hidden check with or without rules, and the paid pilot on public tasks showed no difference (133, 132 and 133 of 144).
- **Rules cost money.** `verify-changes` roughly doubled the cost of a small Sonnet fix ($0.024 to $0.0505). The pilot ran about 7% dearer under noonsight ($0.145 to $0.155 per run).
- **The preset does little for your Opus and Fable sessions.** Attended sessions on either receive nothing by default. No Opus rule has a measured effect, and Fable's only measured effect is shorter sentences in reports.
- **It is very young.** This is version 0.1.0 from a single author, and all the experiments date from 16 to 23 November 2026. The benchmark found nine delivery failures in that week; all are fixed, but that is the recent defect rate.
- **It is low-risk to try.** It has no runtime dependencies, an MIT licence, and hooks that always exit 0 and never block a call. Nothing touches the network unless you turn the classifier on, and `noonsight uninstall` removes it.

**Conditions and risks:**
- **Have rules that differ by model.** If you don't have model-specific or subagent-specific rules you want delivered, `CLAUDE.md` is simpler, and the README says so itself.
- **Pin Claude Code.** Delivery was measured on 2.1.330 only, and several mechanisms rely on behaviour Claude Code does not document. CI runs its live checks on 2.1.325, so run the delivery corpus (`npm run delivery -- corpus`, no login or tokens) before each upgrade.
- **Check the gaps against your usage.**
  - Workflow agents get nothing.
  - Subagents from organization-synced plugins may get the parent model's rules.
  - Split-pane agent teams, routing and the classifier are unmeasured.
  - `/fork` is refused in sessions started with `noonsight run`.
  - The `default` and `opusplan` model settings cannot be resolved.
- **Check your platform and org settings.** The hook launcher is a POSIX shell script, and the machine-wide install does not support Windows. Organization settings that allow only managed hooks stop a per-user install, and server-managed settings make Claude Code ignore the machine-wide one.
- **Treat repo rules as reviewed code.** Once someone runs `noonsight trust` in a repository, later changes to `.noonsight/` pulled from git apply without asking again. Anyone who can merge there can change what goes into teammates' contexts.
- **Configure it deliberately.** Set `session.unattended_when_env` for orchestrated sessions, pass scopes for scoped rules, and install with `npm install -g` rather than `npx`. An `npx` install silently delivers nothing once npm's cache is cleared.
- **Measure during the pilot.** Use `noonsight report` to confirm deliveries, watch for `MISMATCH` warnings, and compare cost and results against a control group. The decision log records what the hook returned, not what reached the model.
- **Expect some overhead.** Each hook run starts a Node process, at roughly 80 to 150 ms of CPU, on session start, agent calls and every Edit or Write.

**What it guarantees:** noonsight guarantees that the rules declared for a model are placed into the requests of sessions and subagents running on that model, not that the model follows them. That guarantee rests on Claude Code's hook behaviour as observed on version 2.1.330 against a stand-in API, and it is checked against noonsight's own resolver.
