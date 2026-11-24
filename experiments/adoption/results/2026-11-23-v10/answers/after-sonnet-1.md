**Verdict: adopt with conditions**

**Reasons**

- **It fits your setup.** It delivers rules per model through Claude Code hooks, to the main session and to each subagent. It re-delivers when the model changes or on `/clear`, compaction, resume and fork. The preset covers Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5. Your mix of models with many subagents is the case it was built for.
- **The delivery claim is measured, not just asserted.** I read the evidence and did not rerun it.
  - On real interactive Claude Code 2.1.330 sessions against a local stand-in for the API, 0 of 299 random sessions broke the invariant. 3,090 of 3,090 requests held their rules, including 763 of 763 subagent requests (D18–D20).
  - A user `CLAUDE.md` reached 88.2% overall and 46.9% of subagent requests. `.claude/rules` reached 76.3%, and skills reached 0% (D25–D29).
  - `CLAUDE.md` and `.claude/rules` also put other models' rules into most requests (D30). Noonsight sent none without a retiring note (D32).
- **The authors test it adversarially.** They found nine of their own failures, F1–F9, which were mostly lost deliveries after `/model`, resume, fork and plan mode. Each has a reproduction that must pass. A self-check plants bugs to confirm the fuzzer catches them. Reproductions of five of the fixed failures break the invariant on the pre-fix build (D24).
- **The hooks are low-risk.**
  - They always exit 0, never block or deny a call, and use no network by default. Each has a 10-second timeout.
  - A bad config is refused whole and warned about, not half-applied.
  - Median CPU per hook is 80–150 ms on a loaded laptop.
  - `NOONSIGHT_DISABLE=1` turns it off per session.
  - A decision log and `noonsight report` let you audit what was delivered.
- **Rule effects are real but narrow.** Some rules measurably change behaviour.
  - On Sonnet 5.5, `verify-changes` took tests-after-last-edit from 0 of 30 to 29 of 30 on the fix task, and `carry-through` took a 13-ticket backlog from 9 of 40 complete to 32 of 40.
  - Fable's `low-context-report` shortened sentences.
  - Opus has no measured rule effect, and no quality gain was shown. The paid pilot found no difference in tasks passed (B1: 133, 132 and 133 of 144).
  - Several measured rules roughly doubled cost per run on the small tasks (R6, R17). Treat the rules as something to evaluate, not a free win.

**Conditions and risks**

- **Install it only if per-model, per-subagent delivery matters to you.** If you only need the same rules everywhere, a `CLAUDE.md` is simpler. The README says so, and a `CLAUDE.md` still misses the built-in Explore and Plan subagents.
- **Pin and re-verify against Claude Code versions.**
  - Several mechanisms rely on undocumented behaviour: how forks are found, `CLAUDE_CODE_SESSION_ATTENDED`, subagent metadata files, and `ps` parsing on macOS.
  - The evidence holds for the versions it ran on (mostly 2.1.330). A Claude Code update can silently break delivery.
  - Run `npm run delivery -- corpus` on each new version, and watch `noonsight report` for rules that are on but never delivered.
- **Know the documented gaps.**
  - A workflow's agents get nothing.
  - Foreground calls of one type that need different rules give their subagents nothing until each one's first Edit, Write or agent call.
  - Plugin-synced agents are predicted on the parent's model.
  - Agent teams in split panes, routing and the classifier are unmeasured. Keep routing and the classifier off.
  - A conversation compacted with no response since, then resumed with no model named, falls back to Claude Code's default model, which noonsight cannot tell.
  - `/fork` is unavailable in `noonsight run` sessions.
- **Configure it for your place and scope.**
  - The preset ships Opus and Fable attended rules off, so attended Opus and Fable sessions get nothing until you `enable` rules.
  - Sonnet and Haiku scoped rules need `NOONSIGHT_SCOPE`.
  - Set `session.unattended_when_env` for unwatched interactive sessions.
  - Write your own team rules and measure them. They have no evidence until you test them.
- **Treat delivery as context, not obedience.** The evidence is a stub with no model, so it shows rules arrive, not that models follow them. Effect results are small tasks on specific rules and models.
- **Expect some governance and operational overhead.**
  - It writes state under `~/.local/state/noonsight` and a decision log.
  - Repo-level `.noonsight/noonsight.json` needs a per-person `noonsight trust`.
  - It was renamed from sextant, and I saw no maintainer or adoption information.
  - It reads local transcripts and settings, so review it before wide rollout. Start with a few people.
- **My own limits.** I did not run the test suite or the benchmark, and I did not read the source. The numbers above are the project's own, checked by its own tests.

**What it guarantees**

It guarantees delivery, not obedience: each session and subagent that runs on a model gets the rules declared for that model, and gets them again when the model changes or the conversation is compacted, cleared, resumed or forked. This rests on Claude Code's hooks and the authors' fuzzing of real Claude Code 2.1.330 sessions against a stub API, with the project's own resolver as the reference and the documented gaps excluded. It holds only for the Claude Code versions it was checked on.
