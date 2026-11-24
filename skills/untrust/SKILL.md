---
description: "Stop applying this project's noonsight configuration."
argument-hint: "[<dir>]"
disable-model-invocation: true
allowed-tools: "Bash(/bin/sh \"${CLAUDE_PLUGIN_ROOT}/scripts/noonsight\" untrust:*)"
---

Show the output below to the person as it is, with nothing added.

```!
/bin/sh "${CLAUDE_PLUGIN_ROOT}/scripts/noonsight" untrust $ARGUMENTS 2>&1 || true
```
