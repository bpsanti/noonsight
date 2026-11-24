import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyEnv, passThrough, planLaunch } from '../adapters/claude-code/launcher.js';
import { notRouted } from '../adapters/claude-code/routing.js';
import { ConfigError, loadConfigDetails } from '../config/load.js';
import { configPath, stateDir } from '../config/paths.js';
import { projectFields, projectFor, projectWarning } from '../config/project.js';
import { appendDecision } from '../state/log.js';
import { writeFileAtomic } from '../state/files.js';
import { packageVersion } from '../version.js';
import { UsageError } from './usage.js';
export const RUN_USAGE = `usage: noonsight run [--scope <scope>] [--task <text>] [--] [claude arguments...]

Start Claude Code with the rules for its model in the system prompt, for sessions the hooks do not
reach or reach without the model, such as \`claude -p\`. noonsight takes the model the way Claude Code
does: --model among the claude arguments, else ANTHROPIC_MODEL, else the model setting. It adds the
rules with --append-system-prompt-file and runs claude with every other argument unchanged. When the
hooks are installed too, they find the rules in the system prompt and do not deliver them again.

With routing on for the launcher, the task scope's row in the routing table adds --model and
--effort first, unless the claude arguments already give --model.

Options, before the claude arguments:
  --scope <scope>   the task scope, set as NOONSIGHT_SCOPE for the session
  --task <text>     the task text the scopes' matchers read when no scope is given; without it,
                    the prompt right after -p or --print

Everything from the first other argument, or after "--", goes to claude. noonsight run exits with
claude's exit status.`;
/** Run claude through the launcher. Resolves to claude's exit status. */
export async function runRun(args, env, io, home = os.homedir()) {
    let scope = null;
    let task = null;
    let rest = [];
    for (let i = 0; i < args.length; i++) {
        const a = args[i] ?? '';
        if (a === '--help' || a === '-h') {
            io.out(RUN_USAGE);
            return 0;
        }
        if (a === '--scope') {
            const value = args[++i];
            if (value === undefined)
                throw new UsageError('--scope needs a value', RUN_USAGE);
            scope = value;
        }
        else if (a.startsWith('--scope='))
            scope = a.slice('--scope='.length);
        else if (a === '--task') {
            const value = args[++i];
            if (value === undefined)
                throw new UsageError('--task needs a value', RUN_USAGE);
            task = value;
        }
        else if (a.startsWith('--task='))
            task = a.slice('--task='.length);
        else {
            rest = args.slice(a === '--' ? i + 1 : i);
            break;
        }
    }
    const plan = env.NOONSIGHT_DISABLE === '1' ? { args: [...rest], env: {} } : prepare(rest, scope, task, env, home, io);
    return exec(plan.args, applyEnv(env, plan.env), io);
}
/** Decide, write the system prompt file and log. Any failure starts claude without the launcher's rules. */
function prepare(args, scope, task, env, home, io) {
    const state = stateDir(home);
    const file = configPath(env, home);
    const log = (fields) => {
        try {
            appendDecision(state, { ts: new Date().toISOString(), version: safeVersion(), event: 'launch', config: file, ...fields });
        }
        catch {
            // A log that cannot be written must not cost the session its rules.
        }
    };
    if (!env.NOONSIGHT_CONFIG && !fs.existsSync(file)) {
        io.err(`noonsight: there is no configuration at ${file}, so noonsight run added no rules. Run \`noonsight init\` to create one.`);
        return passThrough(args, scope, env);
    }
    let plan;
    let projectNote = null;
    try {
        // The session's project: the one Claude Code will find from the same directory.
        const cwd = process.cwd();
        const details = loadConfigDetails(file, { project: projectFor(env.CLAUDE_PROJECT_DIR || cwd, file, state) }, env);
        plan = planLaunch(details.config, file, { args, scope, task, env, home, cwd, state });
        plan = { ...plan, record: { ...plan.record, ...projectFields(details.project) } };
        projectNote = projectWarning(details.project);
    }
    catch (e) {
        if (e instanceof ConfigError) {
            log({ status: 'config-invalid', problems: e.problems.length, ...notRouted('config-invalid'), delivered: 'nothing', warned: true });
            io.err(`noonsight: the configuration at ${file} was refused (${e.problems.length} problem${e.problems.length === 1 ? '' : 's'}), ` +
                'so noonsight run added no rules. Run `noonsight check` to see the problems.');
        }
        else {
            const message = e instanceof Error ? e.message : String(e);
            log({ status: 'error', error: message, ...notRouted('error'), delivered: 'nothing', warned: true });
            io.err(`noonsight: noonsight run failed (${message}), so it added no rules.`);
        }
        return passThrough(args, scope, env);
    }
    if (plan.file !== null) {
        try {
            fs.mkdirSync(path.dirname(plan.file.path), { recursive: true, mode: 0o700 });
            // Written on every launch, which also keeps the file from being pruned while it is in use.
            writeFileAtomic(plan.file.path, plan.file.content, 0o600);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            log({ ...plan.record, status: 'error', error: message, delivered: 'nothing', warned: true });
            io.err(`noonsight: could not write ${plan.file.path} (${message}), so noonsight run added no rules.`);
            return plan.fallback;
        }
    }
    log(projectNote !== null ? { ...plan.record, warned: true } : plan.record);
    for (const m of [...plan.messages, ...(projectNote !== null ? [projectNote] : [])])
        io.err(m);
    return plan;
}
/**
 * Start claude in the foreground and wait for it. The terminal sends Ctrl-C and Ctrl-\ to claude as
 * well, so the launcher ignores them instead of ending under it; a SIGTERM or SIGHUP sent to the
 * launcher alone is passed on.
 */
function exec(args, env, io) {
    return new Promise((done) => {
        const child = spawn('claude', [...args], { stdio: 'inherit', env });
        const ignore = () => { };
        const forward = (signal) => {
            child.kill(signal);
        };
        const handlers = [
            ['SIGINT', ignore],
            ['SIGQUIT', ignore],
            ['SIGTERM', forward],
            ['SIGHUP', forward],
        ];
        for (const [s, h] of handlers)
            process.on(s, h);
        let finished = false;
        const finish = (code) => {
            if (finished)
                return;
            finished = true;
            for (const [s, h] of handlers)
                process.off(s, h);
            done(code);
        };
        child.on('error', (e) => {
            io.err(`noonsight: could not start claude (${e.message}).`);
            finish(127);
        });
        child.on('exit', (code, signal) => finish(code ?? 128 + (signal ? (os.constants.signals[signal] ?? 0) : 0)));
    });
}
function safeVersion() {
    try {
        return packageVersion();
    }
    catch {
        return 'unknown';
    }
}
//# sourceMappingURL=run.js.map