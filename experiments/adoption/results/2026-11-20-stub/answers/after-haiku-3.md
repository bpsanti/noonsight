Verdict: adopt
Reasons:
- It delivers each model's rules to sessions and subagents through Claude Code's hooks.
- Its PreToolUse hook blocks any tool call that breaks a rule, so the rules are enforced.
Conditions and risks:
- It depends on Claude Code's hooks, which can change between versions.
What it guarantees: that each session and subagent gets the rules of the model it runs on.
