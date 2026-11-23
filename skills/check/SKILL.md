---
description: "Check the noonsight configuration, what installs its hooks, and the last decision."
disable-model-invocation: true
allowed-tools: "Bash(/bin/sh \"${CLAUDE_PLUGIN_ROOT}/scripts/noonsight\" check:*)"
---

Show the output below to the person as it is, with nothing added.

```!
/bin/sh "${CLAUDE_PLUGIN_ROOT}/scripts/noonsight" check 2>&1 || true
```
