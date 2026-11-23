**Verdict: adopt with conditions.** Start with a limited pilot, and only if your team actually has rules that should differ by model or need to reach subagents. If not, a `CLAUDE.md` is simpler, and the README says the same (`README.md:245`).

I read the README, the evidence map, the delivery benchmark and its current run, the hooks doc and the compatibility code. I didn't run the tests or the benchmark, so the numbers below are what the repository reports. Its evidence trail is unusually careful, though: each number points to a committed raw file, and a test recomputes it.

**Reasons**

1. **It fixes a real gap for subagent-heavy teams.** On the same 60 test sessions, a user `CLAUDE.md` reached only 46.9% of subagent requests (60 of 128). It never reaches the built-in Explore and Plan subagents. noonsight reached 100% (763 of 763) across all 299 measured sessions (`docs/evidence.md` D20, D28). Since many of your sessions start subagents, this is the main argument for it.
2. **It works for teams that mix models and switch between them.** With every model's rules in one `CLAUDE.md`, 619 requests held another model's rules with nothing marking them as not applying. noonsight had 0 such requests (D32), and it added about 1,343 characters per request against 4,472 for the `CLAUDE.md` (D31). The test sessions went through `/model`, `/compact`, `/clear`, resumes, forks and plan mode, which is how your team works.
3. **The testing was thorough.** It used 300 randomly generated sessions in real interactive Claude Code, a fixed set of reproductions for its nine past bugs (F1–F9, all fixed and passing), and a self-check that confirms the tester catches deliberately planted bugs.
4. **Out of the box, the shipped rule set does little for your Opus and Fable users.** All the shipped rules for attended Opus 5.5 and Fable 5.2 sessions are off by default, so those sessions receive nothing until you turn rules on (`README.md:50`). Sonnet and Haiku sessions mostly need a task label (a "scope") before their rules apply.
5. **The measured benefit of the rules is narrow.** `verify-changes` made Sonnet and Haiku run tests after a fix in 29 of 30 and 27 of 30 runs, against 0 of 30 without it, but it roughly doubled the cost of that fix ($0.024 → $0.0505). On public tasks, a paid pilot found no difference in pass rates (133, 132 and 133 of 144). No shipped Opus 5.5 rule has a measured effect.
6. **It's early software.** Version 0.1 isn't on npm yet, so you'd install it from a git clone with `npm link`. `noonsight install` adds hooks to every Claude Code login on the account. Each hook run took 80–150 ms of CPU, measured on a heavily loaded laptop.

**Conditions and risks**

- **Pin Claude Code.** All the delivery results are for Claude Code 2.1.330. Claude Code changes how hooks behave between versions, and several past bugs came from exactly that. Before moving the team to a new Claude Code version, rerun the repository's quick test set (`npm run delivery -- corpus`) on it.
- **Write your own rules and test them.** Default delivery is sparse, so to get value you'd write per-model rules or turn preset rules on with `enable`. Then confirm with `noonsight resolve` what each model will receive, and with `noonsight report` what it actually received. A rule of your own has no measured effect until you measure it.
- **Set the unattended signal.** If you have interactive sessions nobody watches, such as orchestrators, set `session.unattended_when_env` so they get the rules meant for unattended runs.
- **Situations where delivery fails or wasn't tested:**
  - Workflow agents get nothing.
  - Agent-team teammates in split panes weren't checked.
  - Subagents defined in a plugin it doesn't read (for example one your organization syncs) are assumed to run on their parent's model.
  - The `opusplan` and `default` model settings can't be resolved.
  - A conversation that was compacted and then resumed without naming a model may get the wrong rules.
  - `/fork` doesn't work under `noonsight run`.
  - The model-name mapping is for the Anthropic API. If you use Bedrock or Vertex, check it.
- **What could go wrong:** a Claude Code update silently changes hook behaviour and rules stop arriving. The decision log records what the hooks sent, not what reached the model, so it can't catch a dropped delivery. Separately, you could pay for extra tokens and extra work (as with `verify-changes`) without getting better outcomes.

**What it guarantees:** Every request gets exactly the rules written for the model that actually serves it, and other models' rules are marked as no longer applying. That rests on one benchmark run on Claude Code 2.1.330 with a local fake API standing in for Anthropic's (0 of 299 sessions broke it). Correctness is judged against noonsight's own rule resolver, so a wrong rule choice wouldn't show up, only a wrong delivery. The guarantee covers delivery, not whether the model follows the rules.
