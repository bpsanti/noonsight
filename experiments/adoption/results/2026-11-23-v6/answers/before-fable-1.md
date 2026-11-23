**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few people's machines, pinned to one commit, with routing and the classifier left off. Do not roll it out team-wide yet.

I read the README, the hook contract, the verification notes, the preset sources and the dated experiment results. I did not read the source closely, build it or run its tests, so everything below rests on the project's own documentation and recorded results.

**Reasons**

- **It targets your exact setup.** It gives each session and each subagent only the rules written for the model it runs on, and re-delivers after `/model`, `/clear`, compaction and resume.
- **Delivery beats a shared `CLAUDE.md` in its own tests.** In the delivery fuzz on Claude Code 2.1.328, noonsight covered 99.5% of requests (3 of 300 sessions broke the invariant). On the first 60 sequences:

  | Method | Requests covered | Subagent requests covered |
  | --- | --- | --- |
  | noonsight | 100% | 100% |
  | one `CLAUDE.md` with every model's rules | 87.4% | 32.2% |
  | `.claude/rules` | 70.9% | 32.2% |

  The `CLAUDE.md` never reached Explore and Plan subagents, and it gave each model the other models' rules too (only 18–29% of the text a model read was written for it).
- **No measured gain in task success.** In the 588-run benchmark pilot, 133, 132 and 133 of 144 verified tasks resolved under off, noonsight and `CLAUDE.md`. Cost per run was about 7% higher with noonsight, against 19% for the `CLAUDE.md`.
- **Only some rules have a measured effect.**
  - The verify rules made Sonnet and Haiku run tests after a small fix (30 of 30 and 27 of 30, against 0 of 30), at 46–59% more cost on those small tasks.
  - Sonnet's carry-through rule raised complete runs from 9 to 32 of 40 on one task, at low effort and unattended.
  - Fable's report rule shortened sentences.
  - Haiku's carry-through showed no effect, and the Opus rule and Fable's subagent rule are unmeasured.
- **The default preset is mostly dormant in interactive use.**
  - Interactive Opus and Fable sessions receive nothing.
  - Interactive Sonnet and Haiku sessions receive only the verify rule, after their first edit of a git-tracked code file.
  - Subagents get only the every-scope rules (carry-through for Sonnet and Haiku, the report rule for Fable).
  - The rest needs a scope, which nothing sets by default.
- **It is pre-release.** The version is 0.0.1, marked private, "early development", nothing published, and installed from a clone with `npm link`. The last fuzz run found two delivery failures; the changelog says both are fixed, but no fuzz run after those fixes is recorded.
- **It is low-risk to try.** Hooks always exit 0, never deny a call, read only local files, have no runtime dependencies, and write a decision log. `NOONSIGHT_DISABLE=1` or `noonsight uninstall` turns it off.

**Conditions and risks**

Conditions:
- **Pin versions.** Pin a noonsight commit and stay on Claude Code versions it was checked against (2.1.325–2.1.329). Rerun `npm run test:live` and `npm run delivery -- all` before each Claude Code upgrade.
- **Keep routing off.** In auto mode a routed subagent call causes the other agent calls in the same response to be refused and retried, and by default a routed call runs without a permission prompt.
- **Keep the classifier off.** It sends the first 4,000 characters of each task to a model through a person's login and costs usage.
- **Decide how scopes get set.** Otherwise treat the pilot as testing only the verify rules and the subagent rules. Your own team rules can be added per model.
- **Review the decision log weekly.** `noonsight report` shows mismatches, undeclared models and rules never delivered.

Risks:
- **Claude Code internals.** It depends on hook behaviour that was largely observed, not documented, and several facts were checked by hand once. A Claude Code update can silently change what is delivered.
- **Coverage gaps.** Plugin subagents, `--agents` definitions, agent-team teammates and workflow agents are mispredicted or get nothing. A subagent call held on a permission prompt for a couple of minutes loses its rules.
- **Wrong-model cases.**
  - A resume on the default model after compaction is a documented limit.
  - A model set only by MDM is not read.
  - On Bedrock, Vertex or Foundry, aliases need pinning variables.
  - On macOS, a prompt containing `--model x` can confuse the model detection.
- **Fallback models.** When Claude Code switched models by itself (to Opus 4.8 or Sonnet 5 in the pilot), the new model got only a note retiring the old rules, because the preset has no rules for it.
- **Footprint.** It edits `settings.json` in every Claude Code config directory in the home folder, adds roughly 60–120 ms per hook event, and runs a hook on every Edit and Write.
- **Maintenance.** It appears to be a single-author project, and the preset must be updated for each new model version; until then that model gets a warning and no rules.
- **Windows.** I saw live checks recorded only for macOS and Linux.

**What it guarantees**

It guarantees only that its hooks never block or deny anything and that every decision is logged; delivery of the right rules to the right model is best-effort, and rests on Claude Code's hook behaviour as observed on versions 2.1.325–2.1.329, not on any stable contract.
