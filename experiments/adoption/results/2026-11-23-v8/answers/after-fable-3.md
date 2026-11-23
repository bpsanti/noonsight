**Verdict: adopt with conditions**, as a time-boxed pilot on a few machines, not a team-wide rollout yet.

I read the README, the docs, the evidence map, the current benchmark results and parts of the source. I had no shell, so I did not build it, run its tests or re-run any benchmark.

## Reasons

- **It fits your setup.** It targets mixed-model sessions that start subagents. In its benchmark, a user `CLAUDE.md` reached 100% of main-conversation requests (448 of 448) but only 46.9% of subagent requests (60 of 128), because it never reaches the built-in Explore and Plan subagents.
- **The delivery claim checks out against the committed results.** I recomputed the headline figures from `summary.json`: 299 of 300 sessions ran to the end, 3,090 of 3,090 requests with rules due held them, and 763 of 763 subagent requests did.
- **The code matches its "local only, never blocks" description.** I found no network calls in `src/`. The only subprocesses are `ps`, `git`, `claude --version`, the service manager for the optional watcher, and the classifier's `claude -p`, which is off by default. There are no runtime dependencies.
- **Out of the box it does little for your Opus and Fable sessions.** The preset's attended rules for both ship off, so an interactive session on either receives nothing until you enable rules or write your own.
- **Delivering rules has not been shown to improve outcomes.** The paid pilot passed 133, 132 and 133 of 144 runs with no rules, with noonsight and with a `CLAUDE.md`, and noonsight cost about 7% more per run than no rules. The measured effects are narrow:
  - `verify-changes` made Sonnet and Haiku run the tests after a small fix (29 and 27 of 30 runs, against 0 without), at about double the cost of that fix.
  - `carry-through` on Sonnet raised fully completed backlog runs from 9 to 32 of 40.
  - No Opus rule has a measured effect.
- **It is very young.** It is version 0.0.1, not on npm, from a single maintainer, and installs from a clone. Its benchmark found nine delivery bugs in the past five days, the last fixed in today's run.

## Conditions and risks

Conditions:
- **You have rules that differ by model.** If your rules are the same for every model, a `CLAUDE.md` is simpler, and the README says so itself.
- **Your Claude Code version matches what was measured.** The delivery claim is for 2.1.330 only, and several mechanisms rely on undocumented Claude Code behaviour. Re-run the corpus (`npm run delivery -- corpus`, a few minutes, no tokens) on each Claude Code update.
- **Your organisation allows user hooks.** Managed settings with `allowManagedHooksOnly` or `disableAllHooks` stop it; `noonsight check` reports this.
- **Each person installs it.** Everyone runs `noonsight install`, and runs `noonsight trust` once per repository that carries shared rules. Windows is not supported.
- **You verify delivery yourselves.** Use `noonsight report` during the pilot, and drop any rule whose effect you cannot see.

Risks:
- **Failures are silent.** The hooks never block, so a miss means a session quietly gets no rules or another model's rules. The decision log records what the hook returned, not what reached the model.
- **The benchmark has blind spots.**
  - The API is a local stand-in, with one seed on one machine.
  - The reference for "right rules" is noonsight's own resolver, so a wrong resolution would not show.
  - Raw session files are not committed, so the numbers can only be checked against the aggregate.
  - In its self-check, two of three planted defects failed only 4 of 9 and 7 of 15 exposed sessions, and the rest were not examined.
- **Some paths are uncovered.** Agent teams, routing and the classifier are unmeasured. Workflow agents get nothing, and subagents from organisation-synced plugins are predicted on their parent's model.
- **Automatic model fallback leaves sessions without rules.** In the pilot, Claude Code switched Fable and Opus sessions to Opus 4.8 on one task; an undeclared model gets only a note retiring the old rules.
- **Each hook adds a little latency.** Every hook run starts a Node process, with a median of 80 to 150 ms of processor time measured on a loaded machine, on each session start, model switch, agent call and Edit or Write.
- **Routing can bypass permission prompts.** If you turn routing on, its default `allow` runs the agent calls it changes without a prompt.

## What it guarantees

noonsight guarantees only that each session and subagent request carries the rule text configured for the model it runs on, and no other model's rules left unretired; it does not guarantee the model follows them, and the claim rests on one same-day run of 299 stubbed-API sessions on Claude Code 2.1.330, judged against noonsight's own resolver.
