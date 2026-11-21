**Verdict:** adopt with conditions — as a pinned pilot on a few machines with your own per-model rules, not as a team-wide default yet.

I read the README, changelog, hook and install docs, the preset and its sources, and the delivery and benchmark results, and searched the source for network and process calls. I could not run the tests or the tool in this session, and I did not read `docs/configuration.md` or the hook code line by line.

**Reasons:**
- **It fits your setup.** It hands each session and subagent the rules written for the model it actually runs on, and re-delivers after `/model`, `/clear`, compaction and resume.
- **Delivery is measured and beats the alternatives.** On 60 fuzzed session sequences it covered 650 of 650 requests, against 87.4% for one `CLAUDE.md` and 70.9% for `.claude/rules`. For subagent requests it covered 121 of 121, against 32.2% for both, because `CLAUDE.md` never reaches Explore and Plan subagents.
- **Better results are not shown.** In the 588-run benchmark pilot, tasks resolved at the same rate with and without it (132 against 133 of 144), and runs cost 7% more.
- **Out of the box it does little for interactive work.** With the shipped preset, an Opus or Fable session with no scope gets no rules. Sonnet and Haiku get only a "run the tests" rule after their first edit of a tracked code file.
- **That one rule has a real cost.** It made Sonnet run tests in 30 of 30 runs against 0 of 30 on a one-file fix, at 58–59% more cost per run, and every run passed its hidden check either way.
- **It is pre-release.** Version 0.0.1, unpublished, marked "early development", installed from a clone with `npm link`.
- **Low footprint.** No runtime dependencies, and the source imports no network modules; the hooks always exit 0 and never deny a call.

**Conditions and risks:**
- **Pin Claude Code.** Its behaviour was checked on 2.1.325–2.1.328, and CI pins 2.1.325. The fuzzer found resume behaviours differing by model pair that the author could not explain. Re-run `npm run delivery -- all` (no tokens, about 100 minutes) before each upgrade.
- **Open delivery failures.** Three of 300 fuzzed sessions still broke delivery. The changelog says two of those are since fixed, but I saw no re-run confirming it. One limit remains: a compacted conversation resumed on the default model.
- **Write your own rules or set scopes.** Otherwise you adopt mostly plumbing.
- **Keep routing and the classifier off at first.**
  - Routing in auto mode causes sibling tool calls to be refused and retried, and can send work to Fable, which may bill usage credits.
  - The classifier sends the first 4,000 characters of each task to Haiku and can add up to 8 seconds per subagent call.
- **Subagent gaps.** Agent-team teammates and workflow agents get nothing. Plugin and `--agents` subagents are predicted on the parent's model and only flagged afterwards. Parallel same-type calls on different models can get no rules.
- **Model-detection gaps.** `default` and `opusplan` settings in `claude -p`, and aliases on Bedrock, Vertex or Foundry without pinned variables, produce a warning and no rules. Windows is not supported.
- **Review committed project rules like code.** Once someone trusts a repository's `.noonsight/` file, later changes to it apply without asking again.
- **Installation is fragile.** It edits every `settings.json` in each account, and the hook points at absolute paths to Node and the clone. Moving either silently stops delivery until `noonsight check` is run.

**What it guarantees:** Nothing about model behaviour — only that, without ever blocking a call, its hooks return the rule text you declared for the model it identified, which rests on Claude Code's hook events behaving as observed on versions 2.1.325–2.1.328 and on the model choosing to follow that text.
