**Verdict:** adopt with conditions. Run it as a pilot on a few machines with a pinned Claude Code version, not as a team-wide rollout yet.

I read the README, the hook contract, the evidence map, the benchmark write-ups and parts of the source. I did not run the tool or its tests, and I could not check whether the npm package is published. I checked the `CLAUDE.md` comparison figures against the raw summary file; the noonsight figures are from its own docs.

**Reasons:**

- **It fits your setup.** It delivers per-model rules to each session and subagent, and re-delivers after `/model`, `/compact`, `/clear`, resume and fork. A shared `CLAUDE.md` cannot do that.
- **The subagent gap is real.** In its benchmark, a `CLAUDE.md` holding every model's rules reached 60 of 128 subagent requests and never the built-in Explore and Plan subagents. noonsight reached 763 of 763.
- **A `CLAUDE.md` mixes the models' rules.** Only about a third of the rule text a model received that way was written for it, and nothing retired the rest.
- **Delivery is well tested.** In 299 randomized real Claude Code sessions against a stand-in API, all 3,090 requests with rules due held them.
- **No quality gain is shown.** The paid pilot resolved 133 of 144 tasks without rules, 132 with noonsight and 133 with a `CLAUDE.md`. Runs cost about 7% more with noonsight, against 19% more with the `CLAUDE.md`.
- **Rule effects are narrow.** The measured effects are process changes on small tasks: Sonnet and Haiku ran tests after editing, and Fable wrote shorter sentences in reports. No Opus rule has a measured effect.
- **The preset does little for attended Opus and Fable sessions.** Their attended rules ship off, so those sessions receive nothing until you enable rules or write your own.
- **It is low-risk to try.** It has no runtime dependencies, the hooks never block a call and always exit 0, the hook path spawns only local `git`/`ps`, and the one network path is an opt-in classifier. `noonsight uninstall` removes it.
- **It is young.** This is version 0.1.0 from a single author, and its own benchmark found nine delivery bugs in the week before the current run, all since fixed.

**Conditions and risks:**

- **You need rules that differ by model.** If your rules are the same for every model, a `CLAUDE.md` is simpler, and the README says so itself.
- **Pin Claude Code.** The delivery result holds for 2.1.330 only, and the tool relies on several undocumented Claude Code internals. Rerun its corpus check before each Claude Code upgrade.
- **Known delivery gaps:**
  - Workflow agents get nothing.
  - Parallel same-type subagents needing different rules get theirs late or never.
  - Subagents from organization-synced plugins are predicted on the parent's model.
  - Split-pane agent teams are untested.
- **Undeclared models get no rules.** Rules need exact model IDs. In the pilot, Claude Code switched by itself to Opus 4.8 and Sonnet 5 on one task, which the preset does not cover, and each new model version needs declaring.
- **Leave routing and the classifier off.** Neither is measured, and routing in auto mode causes sibling calls to be refused and retried.
- **Per-person setup.** Everyone runs `noonsight install` and `noonsight trust` per repository; install from npm globally, not `npx`. Mark unwatched interactive sessions as unattended.
- **Small overhead.** Each hook run costs roughly 80–150 ms of CPU, and a local decision log records session IDs and edited file paths.
- **Check it yourselves.** Use `noonsight report` to confirm deliveries, and measure whether your own rules change anything, since the tool does not.

**What it guarantees:** noonsight guarantees that the rules declared for a model are placed in the requests of the sessions and subagents running on it (delivery, not obedience), and that rests on Claude Code's hook behavior as tested on version 2.1.330 with a stand-in API, outside the documented gaps.
