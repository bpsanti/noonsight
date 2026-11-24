**Verdict:** adopt with conditions, as a pilot on a few machines with a pinned Claude Code version, not a team-wide rollout yet.

I read the README, the hook contract, the evidence map, the Claude Code verification list, the changelog and the delivery benchmark's write-up. I could not run `npm test` or the tool itself in this session, and I spot-checked only one benchmark figure against its raw file (the `CLAUDE.md` arm, which matched).

**Reasons:**
- **It fits your setup.** It targets mixed models plus subagents: each session and subagent gets the rules for the model it actually runs on, re-sent after `/model`, compaction, `/clear`, resume and fork.
- **The subagent gap is real.** In its benchmark a shared `CLAUDE.md` reached 100% of main-conversation requests (448 of 448) but only 46.9% of subagent requests (60 of 128); Explore and Plan subagents never get it. noonsight reached 763 of 763.
- **Some rules measurably change behaviour.** With `verify-changes`, Sonnet ran the tests after its last edit in 29 of 30 runs and Haiku in 27 of 30, against 0 of 30 without. With `carry-through`, Sonnet finished a 13-ticket backlog in 32 of 40 runs against 9 of 40.
- **No quality gain is shown.** On the paid pilot, pass rates were 133, 132 and 133 of 144 with no rules, noonsight and a `CLAUDE.md`. The rules also cost money: `verify-changes` roughly doubled the cost of the small fix on Sonnet ($0.0505 against $0.0240).
- **Out of the box it does little for your Opus and Fable sessions.** Their preset rules for attended sessions ship off, so an interactive session on either receives nothing until you enable one or write your own. Opus has no measured rule effect at all.
- **It is low-risk to try.** The hooks never block a call, always exit 0, and use no network (the classifier, off by default, is the only exception). There are no runtime dependencies, it is MIT-licensed, `noonsight uninstall` removes it, and a repository's rules do nothing until each person runs `noonsight trust`.
- **It is very young.** It is version 0.1.0 from a single author, and all the evidence dates from 14 to 23 November 2026. The benchmark found nine delivery failures, the last five fixed just before today's run.
- **The evidence is self-measured.** The benchmark uses a stub API, and its reference is noonsight's own resolver, so a wrong resolution would not show. The native alternatives ran on 60 sequences against noonsight's 300.

**Conditions and risks:**
- **Claude Code version:** results hold only for the version they ran on (2.1.326 to 2.1.330). It relies on undocumented behaviour, such as `CLAUDE_CODE_SESSION_ATTENDED`, fork metadata and the subagent `.meta.json`. Pin the version and rerun `noonsight check` and the live tests before each upgrade.
- **You need rules worth delivering:** decide which rules differ by model, enable or write the Opus and Fable ones, and keep model-independent rules in `CLAUDE.md`. If you have none, the benefit is limited to the Sonnet and Haiku effects above.
- **Known gaps:**
  - Workflow agents get nothing.
  - Agent-team teammates in split panes are unchecked.
  - Subagents from organization-synced plugins are predicted on their parent's model.
  - Routing and the classifier are unmeasured.
  - `default` and `opusplan` models cannot be resolved.
  - On Bedrock, Vertex or Foundry, aliases need pinning variables.
- **Environment:** it needs Node.js 20 or newer on every machine, and managed settings that forbid user hooks will stop it.
- **Overhead:** it adds seven hook entries to every login's `settings.json`, and each hook run costs about 80 to 150 ms of CPU.
- **Delivery is not obedience:** a rule that must never be broken still needs a permission rule or a blocking hook.
- **Exit test for the pilot:** use `noonsight report` and your own tasks to confirm the rules change something you can see, and drop the ones that don't.

**What it guarantees:** it guarantees delivery, not compliance — the rules declared for a model are placed in the requests of each session and subagent running on it, outside its documented limits. That rests on Claude Code's hook behaviour as the author measured it on version 2.1.330, against a stub API.
