**Verdict: adopt with conditions.** Run it as a trial on a few machines first. Don't roll it out team-wide yet.

**Reasons**
- **It fits your setup.** Your team mixes Opus, Sonnet, Haiku and Fable, and many sessions start subagents. noonsight gives each session and each subagent the rules written for the model it actually runs on. It re-delivers them on `/model`, `/compact`, `/clear`, resume and fork. The alternatives are weaker. In the same benchmark a user `CLAUDE.md` reached only 32.2% of subagent requests, `.claude/rules` the same, and per-model skills 0% (D10, D11). A `CLAUDE.md` also puts every model's rules in front of every model, so only 31.5% of its rule text was for the request's model, against 79.0% under noonsight (D12).
- **The delivery evidence is unusually thorough.** Every number in the README links to `docs/evidence.md`, which names its raw file, how it is computed, the date and the Claude Code version. The repo says `npm test` recomputes each number from the raw files. I did not run it.
  - 2.1.328: 3,219 of 3,221 requests (99.9%) held their rules, and 1 of 300 sessions broke the invariant.
  - 2.1.330, after fixes for five more failures it found: 0 of 299 sessions broke it, and 3,090 of 3,090 requests held their rules (D19).
  - The shortest reproductions of the failures it found are kept as a regression corpus. Nine of those failures were fixed along the way, which suggests the authors look for failures rather than only confirm successes.
- **The hooks are low risk.** They never block anything and never use the network. They exit 0 with a 10-second timeout, and cost about 50–90 ms of CPU per run (D15). A bad configuration is refused whole with a warning, and `NOONSIGHT_DISABLE=1` or `noonsight uninstall` turns it off. Hooks do run a few local processes (`ps`, `git ls-files`). The one network exception is the optional classifier, which is off by default.
- **It is honest about its limits.** The README separates delivery from obedience, and lists what it did not measure and the known gaps.
- **Rule effects are real but narrow.** `verify-changes` took test-running after a one-file fix from 0 of 30 to 29 of 30 runs on Sonnet 5.5 (R1, R3). It also roughly doubled that run's cost, from $0.0240 to $0.0505 (R6). On Haiku, `carry-through` showed no effect (R11). Samples are 30–40 runs on small tasks.

**Conditions and risks**
- **Delivery is not obedience.** A delivered rule is context, and the model can ignore it. The effect data covers only the preset's rules, on Fable 5.2, Sonnet 5.5 and Haiku 5.5, not Opus. Any rule your team writes has no measured effect until you measure it.
- **The preset does little for attended sessions on some models.** Opus 5.5's and Fable 5.2's attended rules ship off, so an interactive session on either gets nothing from the preset until you run `enable`. Sonnet 5.5 and Haiku 5.5 get only `verify-changes` after a tracked code edit, plus any scoped rules. Decide what you want delivered per model before judging the tool.
- **It depends on undocumented Claude Code behavior.** It relies on hook behavior that Claude Code doesn't document, such as `CLAUDE_CODE_SESSION_ATTENDED`, the fork and background-job internals, and subagent metadata files. Each fact is verified on specific versions, 2.1.325 to 2.1.330. Claude Code releases will likely break some of them. You need a Claude Code version policy, and a re-run of `npm run test:live` after upgrades.
- **Subagent gaps matter for your usage.**
  - A workflow's agents get nothing.
  - Foreground same-type subagent calls that need different rules get nothing until the subagent's first Edit, Write or agent call.
  - Plugins it does not read, such as organization-synced ones, are predicted on the parent's model.
  - Agent teams in split panes and routing are not measured.
  - Check your own subagent patterns against these.
- **The benchmark is not a real-model test.** It ran against a local stand-in for the API. It proves the rules were in the request, not what a model did with them.
- **It's immature.** Version 0.1 isn't on npm (the name holds an empty placeholder). You install from a clone with `npm link`. The project has one repository and a recent rename (it was called sextant). I saw no evidence of a maintenance track record. Pin a commit and be ready to fork.
- **Setup work falls on you.**
  - `noonsight install` edits every Claude Code login's settings.
  - Set `session.unattended_when_env` for interactive sessions nobody watches.
  - Each person must run `noonsight trust` for repository-level config.
  - Unattended runs default to the `unattended` place. Review the preset-update warnings.
- **Known limit:** a compacted conversation resumed with nothing naming a model runs on Claude Code's default model, which noonsight cannot tell. `/fork` doesn't work in `noonsight run` sessions that have rules.
- **Trial plan.** Use 3–5 people for a few weeks, with `noonsight report` and `check` in routine use and a rollback plan. Drop any rule that changes nothing you can see.

**What it guarantees**
It guarantees that, on the Claude Code versions it was tested on, each session and subagent request carries the rules chosen for its model, scope, place and trigger, with earlier models' rules retired. That claim rests on a fuzzing benchmark of real interactive sessions against a stub API, read request by request. It also rests on documented hook behavior and on checks of undocumented behavior per Claude Code version. It does not guarantee that a model follows the rules.
