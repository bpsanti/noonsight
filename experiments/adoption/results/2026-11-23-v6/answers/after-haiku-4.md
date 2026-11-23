Verdict: adopt with conditions. Run it as a pilot on one or two machines first, and don't roll it out to the whole team until the conditions below hold.

Reasons:
- It addresses a real gap in what you're doing. Your sessions span Opus, Sonnet, Haiku and Fable, and many start subagents. The README reports that a `CLAUDE.md` reached 100% of a session's own requests but only 32.2% of subagent requests (39 of 121), and that `.claude/rules` covered 70.6% of requests. noonsight covers subagents through hooks, and its measured coverage was 100% for both requests and subagent requests (README:32-37).
- It is built to be checked. `noonsight report` shows what was delivered, to which model, scope and place, and `noonsight resolve` prints the exact text a model would receive before any session runs (README:83-103, 151).
- It has no runtime dependencies, reads only local files, and its hooks never block or use the network. The only exception is the classifier, which is off by default (README:228-229).
- Its results are for the delivery layer, not behaviour. The README is explicit that delivery is not obedience, and the one measured behaviour change is narrow: `verify-changes` raised test runs after a one-file fix from 0 of 30 to 27–29 of 30 on Sonnet and Haiku, at roughly double the cost on one sample (README:200-201).
- The "what it guarantees" figures come from a stand-in API that never runs a model, on Claude Code 2.1.328 and 2.1.330 (README:19, 20). Your Claude Code version may differ.

Conditions and risks:
- Pin and test your Claude Code version. The README says hooks behave differently between releases, and each fact is checked against a specific version (README:59). Confirm your version is one of the tested ones before relying on it.
- Install per machine. `noonsight install` adds hooks to every Claude Code login on the account, and the package is not on npm yet, so each person installs from a clone (README:63-75).
- Set the unattended variable. Attended sessions are the default. Headless runs such as `claude -p` or the Agent SDK are unattended by default, but any interactive session nobody watches needs `session.unattended_when_env` set (README:53, 234), or it gets the wrong preset rules.
- Know which rules are off. The Opus and Fable attended rules ship off, so an attended Opus or Fable session receives nothing from the preset until someone runs `enable` (README:49, 179). Check with `noonsight models` for each model.
- Expect known gaps. Workflow agents receive nothing. Foreground calls of one subagent type that need different rules give their subagents nothing until the first Edit, Write or agent call. Plugin-synced subagents inherit the parent's model. Compacted sessions resumed with no model named can run on Claude Code's default model, which noonsight cannot detect. `/fork` is unavailable in sessions started with `noonsight run` (README:56-58; docs/hooks.md:383-384).
- Repository rules need a trust step. A committed `.noonsight/noonsight.json` does nothing until each person runs `noonsight trust` in that repository (README:138-139).
- Cost. Rules like `verify-changes` add tool work. Track spend per rule with `noonsight report` during the pilot.
- Pilot success test (my suggestion, not from the README): over a week of real use, `noonsight report` shows each intended rule delivered to subagents and attended sessions, and `noonsight resolve` output matches what you intended for each model. If either fails, do not roll it out.

What it guarantees: noonsight guarantees that each Claude Code session and subagent it reaches receives the rules written for its own model, with the scope and place you configured, and records each delivery; this rests on its hooks, which the author measured on a stand-in API and specific Claude Code versions, and it does not guarantee the model follows the rules or that the hooks reach workflow agents or other gaps listed above.

I read the README, the hooks documentation and the evidence summaries only. I did not install the tool, run its tests or run a live session, so the verdict depends on the author's published results.
