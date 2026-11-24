---
description: "Apply this project's noonsight configuration to the sessions that run in it."
argument-hint: "[<dir>]"
disable-model-invocation: true
allowed-tools: "Bash(/bin/sh \"${CLAUDE_PLUGIN_ROOT}/scripts/noonsight\" trust:*)"
---

Show the output below to the person as it is, with nothing added.

```!
/bin/sh "${CLAUDE_PLUGIN_ROOT}/scripts/noonsight" trust $ARGUMENTS 2>&1 || true
```
