## Verdict: adopt with conditions

Run it as a time-boxed pilot on a few machines, pinned to the Claude Code version it was tested on. Don't roll it out to the whole team yet.

I read the README, the hook contract (`docs/hooks.md`), the hook wiring, the plugin launcher script, the changelog and the delivery benchmark's results and limits. I did not run the test suite or install it.

## Reasons

- **It addresses a real gap in your setup.** You mix four models and use subagents heavily, and that is exactly where the built-in options fall short. In the tool's own benchmark (Claude Code 2.1.330), a user `CLAUDE.md` reached only 46.9% (60 of 128) of subagent requests, and `.claude/rules` also reached 46.9%. Both also give every model the other models' rules (`README.md:42-47`). `CLAUDE.md` never reaches the built-in Explore and Plan subagents.
- **Its delivery record is strong, but only for one version and a simulated API.** It delivered the right rules to 3,090 of 3,090 requests that had rules due, 763 of 763 of them from subagents, across 299 generated sessions. Those were real Claude Code sessions, but the API was a local stand-in, so no model ever answered (`README.md:29-32`). The result was checked against noonsight's own rule-matching logic, so a wrong match would not show up there (`experiments/delivery/README.md:272`).
- **The rules themselves have weak evidence.** A rule with a measured effect gets the model to do something specific, for example `verify-changes` made Sonnet/Haiku run the tests after editing in 29 of 30 runs, against 0 of 30 without it. But no quality gain was shown: a paid pilot found 133/144 tasks passed with no rules, 132/144 under noonsight, and 133/144 with a `CLAUDE.md` holding every model's rules (`README.md:224`). None of the Opus 5.5 rules has a measured effect. Those tasks were small.
- **Out of the box it does little for Opus and Fable.** Their rules for attended sessions ship turned off, so your interactive sessions on those models get nothing from the preset until you turn rules on (`README.md:52`). The value you get depends on writing your own rules.
- **It doesn't get in the way.** The hooks never block a call, always exit successfully, and each has a 10-second timeout. It has no runtime dependencies. It changes an agent call only when the optional routing feature is on. `NOONSIGHT_DISABLE=1` turns it off for a session (`docs/hooks.md:10-25`).
- **It is young and depends on undocumented behavior.** It is at version 0.1.0, with a single upstream repo (`bpsanti/noonsight`). Handling of forks, unattended sessions and subagents relies on Claude Code internals that aren't documented (`forkedFrom`, `CLAUDE_CODE_SESSION_ATTENDED=0`, the `toolUseId` in subagent metadata, `state.json` in background jobs) (`docs/hooks.md:123,168,330`). The benchmark itself found nine of the tool's own bugs (F1 to F9) in the runs before the current one; all are now fixed.

## Conditions and risks

**What would have to hold:**
- You run Claude Code 2.1.330, or you re-run its delivery benchmark (`npm run test:live` plus `experiments/delivery`) on each Claude Code version you upgrade to. Its results only hold for the version they ran on (`README.md:26`).
- Someone owns the rule files and checks `noonsight report` to drop rules that never change anything visible.
- Everyone on the team installs it the same way: npm global, not `npx`, which stops delivering once the npm cache is cleared. Each person runs `noonsight trust` in each shared repo.
- You set `session.unattended_when_env` for interactive sessions nobody watches (for example, ones an orchestrator starts), and set `NOONSIGHT_SCOPE` where you want the scoped rules.
- You're on the Anthropic API, or you pin the `ANTHROPIC_DEFAULT_*_MODEL` variables. On Bedrock, Vertex or Foundry, model aliases point to other models and the hook only warns.
- Ideally, run your own A/B test of your actual rules on your own tasks before rolling out widely.

**What could go wrong:**
- **Silent gaps:**
  - Workflow agents get nothing.
  - Agent-team teammates in split panes were never tested.
  - Subagents from plugins your organization syncs are predicted on the wrong model; the tool only warns about the mismatch afterwards.
  - Sessions on `default` or `opusplan`, or with a model set only in an MDM profile, can't be resolved.
  - When several subagents of the same type start at once and need different rules, each gets nothing until its first Edit, Write or agent call.
- **Breaks when Claude Code changes:** a Claude Code update can quietly change hook behavior it depends on.
- **Cost:** `verify-changes` roughly doubled cost per run on the small fix task ($0.0505 vs $0.0240 for Sonnet). Opus and Fable rules that ship off are documented as adding about 20% to 80% more output tokens.
- **macOS:** it reads the `claude` command line through `ps`. A prompt containing `--model x` can't be told apart from the real option; that case produces a warning, not a wrong guess.
- **Footprint:** `noonsight install` changes the settings of every Claude Code login on the account. It also writes state under `~/.local/state/noonsight/`, including a decision log of up to 2×20 MB.
- **Other side effects:**
  - `/fork` stops working in sessions started with `noonsight run`.
  - With routing on in auto mode, the other agent calls in the same response get refused and have to be made again.
  - The optional classifier sends the first 4,000 characters of each task through your login.

## What it guarantees

noonsight guarantees only **delivery**: each session and subagent gets the rules declared for the model it actually runs on in its context, and gets them again after a model switch, compaction, clear, resume or fork. It does not guarantee the model follows them. That guarantee rests on undocumented Claude Code hook behavior, checked only on Claude Code 2.1.330 against a stand-in API, and it excludes the gaps listed above.
