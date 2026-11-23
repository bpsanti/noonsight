**Verdict: adopt with conditions.** Run it as a pilot on a pinned Claude Code version, not as a team-wide rollout yet.

I read the README, the evidence map, the changelog, the delivery benchmark's design and limits, and the list of Claude Code behaviours it depends on. I did not run its tests or install it.

**Reasons**

1. **It fixes a real gap for a team like yours.** Putting every model's rules in a user `CLAUDE.md` reaches 100% of the main conversation's requests, but only 46.9% of subagent requests (60 of 128). It never reaches the built-in Explore and Plan subagents. It also sends every model the other models' rules: only 32.6% of the rule text in a request was written for that request's model. The tool's own run reports 100% of subagent requests covered (763 of 763), and 78.6% of the rule text belonging to the request's model.
2. **The delivery claim is backed by checkable data.** Every number links to a raw result file in `docs/evidence.md`, and `npm test` recomputes it. It also documents its own limits and nine failures it found and fixed (F1–F9).
3. **The proven benefit is small.** On real public tasks, the paid pilot found no measurable difference in tasks passed: 133/144 with no rules, 132/144 with the tool, 133/144 with a `CLAUDE.md`. The tool added about 7% to cost. The measured effects are on small tasks and only for some rules:
   - `verify-changes` made Sonnet and Haiku run tests after a fix about 29 times in 30, and roughly doubled the cost of that fix.
   - `carry-through` on Sonnet raised completed backlogs from 9/40 to 32/40.
   - `low-context-report` on Fable shortened its reports.
   - **No Opus rule has any measured effect.**
4. **With the shipped rules, your everyday sessions get very little.** An interactive Opus or Fable session receives nothing, because those rules ship off. Interactive Sonnet and Haiku sessions get one rule, and only after they edit a tracked code file, unless you set a scope. The value depends on you writing your own rules that differ by model.
5. **It is very young.** It is version 0.0.1, marked private, not on npm, and installed from a clone. It comes from one GitHub account, and its dated runs and checks all fall between 2026-11-14 and 2026-11-23.

**Conditions and risks**

Conditions:
- **You have instructions that really differ by model**, or that subagents must receive. Otherwise the README itself says to keep using a `CLAUDE.md`.
- **Pin Claude Code to 2.1.330**, the only version the delivery claim was measured on. Re-run its checks (`npm run test:live`, `noonsight check`) before each upgrade. The tool depends on undocumented behaviour, for example:
  - the `CLAUDE_CODE_SESSION_ATTENDED` environment variable,
  - the `forkedFrom` entries in transcripts,
  - reading resume order from transcripts,
  - running `ps` on macOS to read `--agents`.

  A Claude Code update can quietly break delivery.
- **Set `session.unattended_when_env`** for orchestrated sessions that nobody watches, and turn on rules with `enable` or scopes. Otherwise most sessions get nothing.
- **Use `noonsight report`** to confirm that rules arrive. Measure the effect of your own rules yourself; no rule you write has a measured effect.

Risks:
- **The guarantee checks itself.** The benchmark's "right rules" come from the tool's own resolver, so a wrong resolution would not show up. Only a wrong delivery would.
- **Known gaps for subagents:**
  - Workflow agents get nothing.
  - Several foreground calls of one type that need different rules give nothing until each subagent's first edit.
  - Subagents from plugins the tool doesn't read, such as ones your organisation syncs, get their parent model's rules.
  - Agent teams in split panes were not checked.
- **Other paths it misses:** agent teams, routing and the classifier are not measured. A compacted conversation resumed with no model named can get the wrong rules. `/fork` doesn't work in sessions started with `noonsight run`.
- **Install and run cost:**
  - `install` adds hooks to every Claude Code login on the account.
  - Each hook run takes about 80–150 ms of CPU.
  - Each request carries about 1,300 extra characters.
  - It writes a decision log to `~/.local/state/noonsight/`.
- **The blast radius is small.** The hooks never block anything and use no network unless you turn on the classifier. You can turn it off with `NOONSIGHT_DISABLE=1` for one session or `noonsight uninstall` for good.

**What it guarantees:** Each session and subagent's requests hold the rule text configured for the model it actually runs on, with other models' rules marked as no longer applying. That claim rests on 299 scripted sessions of real Claude Code 2.1.330 sent to a local fake API, so no model ever answered, checked against the tool's own resolver. It says nothing about whether models follow the rules or whether outcomes get better.
