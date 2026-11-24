**Verdict: adopt with conditions.** Run it as a time-boxed pilot first, not as a team-wide default.

**Reasons**

1. **It addresses a gap your setup actually has.** Your team mixes models and uses many subagents. The tool's own benchmark shows that a user `CLAUDE.md` reaches every main-conversation request, but only 46.9% (60 of 128) of subagent requests. It never reaches the built-in Explore and Plan subagents. Under noonsight, 100% of 763 subagent requests got their rules, and 100% of 3,090 requests overall. See `docs/evidence.md` D19, D20, D28 and D34.
2. **It stops each model from getting the other models' rules.** With a `CLAUDE.md`, 619 requests held another model's rules with nothing telling the model to ignore them. With `.claude/rules` it was 622, and under noonsight it was 0 (D32). Only 32.6% of the rule text under a `CLAUDE.md` was written for the model reading it, against 78.6% under noonsight (D30).
3. **The evidence is unusually traceable.** Each number points to a committed raw file, and `test/evidence.test.ts` recomputes it. The benchmark found nine of its own bugs (F1 to F9) and kept a test case for each one. That is a good sign of honesty, but see risk 2.
4. **Getting rules delivered does not show better results.** Rules do change narrow behaviours. For example, `verify-changes` made Sonnet and Haiku run tests after a one-file fix in 30 and 27 of 30 runs, against 0 of 30 without it (R14). But there was no measured quality gain. Every one of 600 runs passed its hidden check with or without rules (R8). The paid pilot was 133, 132 and 133 of 144 for no rules, noonsight and a `CLAUDE.md` (B1). The value is whatever your own rules are worth.
5. **It costs money and time.** Rules raised the cost per run by about 50% for Sonnet on a fix ($0.0240 to $0.0378) and about doubled it for Haiku ($0.0015 to $0.0033) (R6, R7). Each hook run took a median 80 to 150 ms of processor time on a busy laptop (D33).
6. **The preset does little for Opus by default.** Opus 5.5's and Fable 5.2's rules for sessions someone is watching ship turned off. So an interactive Opus or Fable session gets nothing from the preset until you enable rules. None of Opus's preset rules has a measured effect.

**Conditions and risks**

- **Conditions:**
  - You have rules that really differ by model, or that subagents must get. If every session could share one set of rules, the README itself says a `CLAUDE.md` is simpler.
  - You put Claude Code on version 2.1.330 for the pilot. The tool's version-free test suite, `npm run delivery -- corpus`, needs no login and spends no tokens. Run it before each Claude Code upgrade.
  - You set `session.unattended_when_env` for unattended interactive sessions, and you check deliveries with `noonsight report`.
  - Rules shared by every model stay in `CLAUDE.md`. Measure any rule of your own before trusting it.
- **Risk 1: it depends on Claude Code's hook behaviour.** That behaviour changes between versions. The current delivery numbers hold for 2.1.330 only, and the other results ran on 2.1.326 to 2.1.329.
- **Risk 2: it is young.** This is version 0.1.0, and the evidence covers one week (2026-11-16 to 23). Nine bugs were found that week, five of them only when new session paths were added. More probably exist on paths nobody has tried yet.
- **Risk 3: some subagents get nothing.** This includes:
  - workflow agents;
  - subagents from organization-synced plugins it doesn't read, which it assumes run on their parent's model and are not given their own rules;
  - several foreground calls of one type that need different rules, until each subagent's first Edit, Write or agent call.

  Agent teams in split panes were never checked (`docs/hooks.md:391-401`).
- **Risk 4: `/fork` doesn't work in sessions started with `noonsight run`.**
- **Risk 5: the benchmark has limits.** It used a stand-in for the API, so no model ever answered. It also checked delivery against noonsight's own resolver, so a wrong choice of rules would not show up.

**What it guarantees:** It guarantees that the rules you declared for a model are added to the requests of each session and subagent running on that model, and added again after a model switch, compaction, clear, resume or fork. It does not guarantee the model follows them. That rests on Claude Code's hook behaviour as observed on 2.1.330 and a stand-in-API benchmark with the documented exceptions above.

I based this on the docs, the evidence map and the experiment write-ups. I did not run the test suite or the benchmark myself.
