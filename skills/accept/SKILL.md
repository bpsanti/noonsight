---
description: "Accept the installed preset version of noonsight: list what it changes, then record it in the configuration."
disable-model-invocation: true
allowed-tools: "Bash(/bin/sh \"${CLAUDE_PLUGIN_ROOT}/scripts/noonsight\" accept:*)"
---

Show the output below to the person as it is, with nothing added.

```!
/bin/sh "${CLAUDE_PLUGIN_ROOT}/scripts/noonsight" accept 2>&1 || true
```
