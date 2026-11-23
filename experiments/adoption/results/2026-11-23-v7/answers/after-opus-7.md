Verdict: **Adopt with conditions.** Run it as a time-boxed pilot with your own rules. Don't roll it out team-wide as infrastructure yet.

I read the README, `docs/hooks.md`, `docs/evidence.md` and `experiments/delivery/README.md`. I did not audit the source code or run its tests.

## Reasons

1. **It solves a real problem that native options don't, especially for subagents.** On the same 60 benchmark sessions, a user `CLAUDE.md` gave subagents their rules on only 32.2% of requests (39 of 121), and per-model skills on 0%. noonsight scored 100% (`docs/evidence.md` D6–D11). `CLAUDE.md` is fine for the main conversation (100%, D17), but it fails exactly where your sessions spread out across models and subagents. It also hands every model the other models' rules: only 31.5% of the rule text in a request was meant for that model, against 79.0% under noonsight (D12).
2. **The evidence is unusually careful.** Every number links to a committed raw file and is recomputed by `npm test`. There is a fuzzer with planted-bug self-checks and a shrinker. Comparisons were registered in `plan.json` before the runs. Limits and failures are written down openly.
3. **It is also very new and still moving.** It is version 0.1, not on npm, installed from a git clone. The fuzzer found nine real delivery bugs (F1–F9) between 2026-11-19 and 2026-11-23, five of them on the newest paths. The clean result (0 of 299 failing sessions, D18) is from one run, on one Claude Code version (2.1.330), dated today. Nobody has seen yet whether it stays clean.
4. **It depends on undocumented Claude Code behaviour.** Fork detection reads `forkedFrom` in transcripts, `state.json` of background jobs and the most recently written transcript. It also relies on `CLAUDE_CODE_SESSION_ATTENDED=0`, the subagent metadata field `toolUseId`, and how plan mode substitutes models. The docs say outright that "none of these is documented by Claude Code" (`docs/hooks.md`, Forks). Any Claude Code update can quietly break delivery. You would see it only if you watch `noonsight report` or re-run the corpus.
5. **Out of the box, the preset gives your Opus and Fable users almost nothing.** Attended Opus 5.5 and Fable 5.2 sessions get no preset rules until you `enable` them, because those rules ship off. Attended Sonnet and Haiku sessions get little without a scope (`NOONSIGHT_SCOPE`) or a code edit. The value comes from rules you write, not from the preset.
6. **Delivery is not obedience.** The tool says so itself. The rule-effect data is mixed and comes from small tasks with 30–40 runs per arm. `verify-changes` made Sonnet and Haiku run tests on a fix where they otherwise didn't (R1/R3), but it roughly doubled Sonnet's cost on that task ($0.0240 → $0.0505, R6). Haiku's `carry-through` showed no effect (R11). Where the models already did the work, the rules changed nothing (R8).

## Conditions and risks

**What would have to hold:**
- You actually have rules that differ by model, by kind of task or by place. If every session should get the same instructions, `CLAUDE.md` is simpler, and the README says the same.
- Someone owns it. After each Claude Code upgrade they run the delivery corpus (`npm run delivery -- corpus`) before people move to the new version, or at least check `noonsight report` for `MISMATCH` and missing deliveries.
- You pin the noonsight commit and review changes before updating. It is a clone of a third-party repo whose hooks run in every session of every account it is installed on.
- You set `session.unattended_when_env` for interactive sessions nobody watches. Otherwise they get the attended rules.
- Everyone uses the same platform as the measurements (darwin-arm64), or you re-run the benchmark on yours. Linux takes a different command-line path, and none of the committed results ran on it.

**What could go wrong:**
- **Silent breakage after a Claude Code update.** Hooks never block, so a failed delivery just means a session without its rules. The decision log records what the hook returned, not what reached the model.
- **Subagent gaps you can't see.** These all apply to how you work:
  - Several subagents of the same type started in parallel that need different rules get nothing until their first Edit, Write or agent call.
  - Workflow agents get nothing.
  - Plugins noonsight doesn't read, such as ones an organization syncs, get their model predicted wrongly.
  - Agent teams in split panes, routing and the classifier were never measured.
- **Fork mix-ups.** A `--continue --fork-session` fork can pick up the wrong original if another session in the same project writes a transcript at the same moment.
- **Models it can't identify.** `opusplan`, `default` and custom gateway model IDs produce a warning, not rules.
- **Cost.** Each request gets about 1,155 extra characters (D13). Rules that make the model do more work cost more per run.
- **Opt-in features with side effects.** Routing rewrites agent calls, and in auto mode that makes Claude Code refuse the other calls in the same response. The classifier sends the first 4,000 characters of a task to a model under the user's login. Leave both off.

## What it guarantees

It promises to deliver each model's rules into the context of every session and subagent request; it does not promise they get followed. That promise rests on one fuzz run of 300 sessions on Claude Code 2.1.330 on macOS, talking to a stub API instead of a real model and judged against noonsight's own rule resolver. It also rests on several Claude Code hook behaviours that are undocumented and could change in any release.
