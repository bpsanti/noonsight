# Pause switch and quiet hours

`backup`, `cleanup` and `reminders` honor both controls.
`backup` checks `settings.paused` and `inQuietHours` (src/jobs/backup.js:6).
`cleanup` and `reminders` call `mayRun`, which checks both (src/jobs/cleanup.js:6, src/jobs/reminders.js:6, src/settings.js:17).

`digest` checks the pause switch but not the quiet hours (src/jobs/digest.js:4).
`metrics` reads `settings.pause`, a field that does not exist, so the pause switch never stops it (src/jobs/metrics.js:6).
`sync` runs on its own timer outside the scheduler and checks neither (src/jobs/sync.js:3).

Ignores a control: digest, metrics, sync
