Verdict: adopt with conditions
Reasons:
- We run several models, and it hands each session and subagent the rules written for the model it runs on, through Claude Code hooks; the delivery benchmark shows 99.5% of requests with rules due holding them over 300 random sessions.
- A CLAUDE.md does not reach the Explore and Plan subagents and gives every model the other models' rules.
- The verify rules made Sonnet and Haiku run the tests after a precise fix, where they otherwise did not.
Conditions and risks:
- Delivery is not obedience: a rule is context, and several rules showed no effect on the measured tasks.
- It is pre-release and installed from a clone, and it depends on Claude Code's hook behavior across versions.
- A watched session without a scope gets none of the preset's rules, so we must set scopes.
What it guarantees: that each Claude Code session and subagent receives the rules declared for its own model, through hooks, as measured by the delivery benchmark, not that the model follows them.
