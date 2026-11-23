---
description: "Write the noonsight configuration from the preset when there is none, then check everything."
disable-model-invocation: true
allowed-tools: "Bash(/bin/sh \"${CLAUDE_PLUGIN_ROOT}/scripts/noonsight\" init:*), Bash(/bin/sh \"${CLAUDE_PLUGIN_ROOT}/scripts/noonsight\" check:*)"
---

Show the output below to the person as it is, with nothing added.

```!
/bin/sh "${CLAUDE_PLUGIN_ROOT}/scripts/noonsight" init 2>&1 || true
```

```!
/bin/sh "${CLAUDE_PLUGIN_ROOT}/scripts/noonsight" check 2>&1 || true
```
