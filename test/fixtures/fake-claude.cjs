// Stands in for the claude process that runs a hook: its own arguments are the "claude" command line
// the hook reads, and it runs the hook command given in NOONSIGHT_FAKE_HOOK (a JSON list) as its child,
// passing stdin and stdout through.
const { spawnSync } = require('node:child_process');
const [file, ...args] = JSON.parse(process.env.NOONSIGHT_FAKE_HOOK || '[]');
const env = { ...process.env };
delete env.NOONSIGHT_FAKE_HOOK;
const r = spawnSync(file, args, { stdio: 'inherit', env });
process.exit(r.status === null ? 1 : r.status);
