// The per-user service that keeps the watcher running: a launchd agent on macOS and a systemd user
// service on Linux. Both start the watcher at login and restart it if it ends. The service file is
// the only file `noonsight watch enable` writes, and the only one `noonsight watch disable` removes.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { stateDir, type Env } from '../config/paths.js';
import { packageVersion } from '../version.js';

/** The launchd label and the systemd unit name. */
export const SERVICE_LABEL = 'io.github.bpsanti.noonsight.watch';
export const SERVICE_UNIT = 'noonsight-watch.service';

/** The file the watcher appends to, through the service's standard output and error. */
export const WATCH_LOG = 'watch.log';

/** The line every service file carries, so disable never removes a file noonsight did not write. */
const MARKER = 'Written by `noonsight watch enable`; `noonsight watch disable` removes it.';

export interface WatchRuntime {
  /** The Node.js executable. */
  readonly node: string;
  /** noonsight's command line entry point. */
  readonly cli: string;
}

export interface WatchService {
  readonly platform: 'darwin' | 'linux';
  /** The launchd label, or on Linux the systemd unit name. */
  readonly name: string;
  /** The service file. */
  readonly file: string;
  /** Where the watcher's output goes. */
  readonly log: string;
}

export class WatchUnsupported extends Error {
  constructor(platform: string) {
    super(`the watcher runs as a launchd agent on macOS or a systemd user service on Linux; ${platform} is not supported`);
    this.name = 'WatchUnsupported';
  }
}

export function watchService(env: Env, home: string, platform: NodeJS.Platform = process.platform): WatchService {
  const log = path.join(stateDir(home), WATCH_LOG);
  if (platform === 'darwin') return { platform, name: SERVICE_LABEL, log, file: path.join(home, 'Library', 'LaunchAgents', `${SERVICE_LABEL}.plist`) };
  if (platform === 'linux') {
    // systemd reads user units from $XDG_CONFIG_HOME/systemd/user, which defaults to ~/.config.
    const config = env.XDG_CONFIG_HOME && path.isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : path.join(home, '.config');
    return { platform, name: SERVICE_UNIT, log, file: path.join(config, 'systemd', 'user', SERVICE_UNIT) };
  }
  throw new WatchUnsupported(platform);
}

/** The service file's content: it runs `noonsight watch run` with this Node.js and this copy of noonsight, by absolute paths. */
export function serviceContent(service: WatchService, runtime: WatchRuntime): string {
  if (service.platform === 'darwin') {
    const string = (s: string): string => `<string>${xmlEscape(s)}</string>`;
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      `<!-- ${MARKER} -->`,
      `<!-- noonsight ${packageVersion()} -->`,
      '<plist version="1.0">',
      '<dict>',
      `  <key>Label</key>${string(service.name)}`,
      '  <key>ProgramArguments</key>',
      `  <array>${[runtime.node, runtime.cli, 'watch', 'run'].map(string).join('')}</array>`,
      '  <key>RunAtLoad</key><true/>',
      '  <key>KeepAlive</key><true/>',
      '  <key>ProcessType</key><string>Background</string>',
      `  <key>StandardOutPath</key>${string(service.log)}`,
      `  <key>StandardErrorPath</key>${string(service.log)}`,
      '</dict>',
      '</plist>',
      '',
    ].join('\n');
  }
  return [
    `# ${MARKER}`,
    `# noonsight ${packageVersion()}`,
    '[Unit]',
    'Description=noonsight: add the Claude Code hooks to each new Claude Code configuration directory',
    '',
    '[Service]',
    `ExecStart=${[runtime.node, runtime.cli, 'watch', 'run'].map(systemdQuote).join(' ')}`,
    'Restart=always',
    'RestartSec=10',
    `StandardOutput=append:${systemdPath(service.log)}`,
    `StandardError=append:${systemdPath(service.log)}`,
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n');
}

/** The service file's content, or null when there is none. */
export function readServiceFile(service: WatchService): string | null {
  try {
    return fs.readFileSync(service.file, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

/** Whether a service file was written by noonsight. */
export function isOurs(content: string): boolean {
  return content.includes(MARKER);
}

export type WatcherState = 'running' | 'loaded' | 'off';

/** Whether the service manager has the service loaded, whether or not a process runs. */
export function isLoaded(state: WatcherState | null): boolean {
  return state === 'running' || state === 'loaded';
}

export interface ManagerResult {
  readonly ok: boolean;
  readonly detail: string;
}

/**
 * The service manager's commands. They are run by name from PATH, as a shell would, so the tests
 * can stand in for them.
 */
export const manager = {
  /** Start the service now, and at every login from now on. */
  load(service: WatchService): ManagerResult {
    if (service.platform === 'darwin') return run('launchctl', ['bootstrap', domain(), service.file]);
    const reload = run('systemctl', ['--user', 'daemon-reload']);
    if (!reload.ok) return reload;
    return run('systemctl', ['--user', 'enable', '--now', service.name]);
  },
  /**
   * Stop the service and keep it from starting at login. Without its unit file systemd cannot
   * disable the unit, so only the stop is done, and a link to the file may remain.
   */
  unload(service: WatchService): ManagerResult {
    if (service.platform === 'darwin') return run('launchctl', ['bootout', `${domain()}/${service.name}`]);
    if (!fs.existsSync(service.file)) return run('systemctl', ['--user', 'stop', service.name]);
    return run('systemctl', ['--user', 'disable', '--now', service.name]);
  },
  /** Make the service manager forget a unit file that was removed; macOS has nothing to forget. */
  forget(service: WatchService): ManagerResult {
    if (service.platform === 'darwin') return { ok: true, detail: '' };
    return run('systemctl', ['--user', 'daemon-reload']);
  },
  /** Whether the service is running, loaded without a process, or off; null when the service manager cannot say. */
  running(service: WatchService): WatcherState | null {
    const r =
      service.platform === 'darwin'
        ? spawnSync('launchctl', ['print', `${domain()}/${service.name}`], { encoding: 'utf8', timeout: 10000 })
        : spawnSync('systemctl', ['--user', 'is-active', '--quiet', service.name], { encoding: 'utf8', timeout: 10000 });
    if (r.error) return null;
    if (service.platform === 'darwin') {
      // launchctl print exits 113 for an unknown service; a loaded job prints its state, and a pid only while it runs.
      if (r.status === 113) return 'off';
      if (r.status !== 0) return null;
      return /^\s*state = running$/m.test(r.stdout) && /^\s*pid = \d+$/m.test(r.stdout) ? 'running' : 'loaded';
    }
    // systemctl is-active exits 3 for an inactive unit.
    if (r.status === 0) return 'running';
    if (r.status === 3) return 'off';
    return null;
  },
};

function run(command: string, args: readonly string[]): ManagerResult {
  const r = spawnSync(command, [...args], { encoding: 'utf8', timeout: 30000 });
  const shown = `${command} ${args.join(' ')}`;
  if (r.error) return { ok: false, detail: `${shown}: ${r.error.message}` };
  if (r.status !== 0) return { ok: false, detail: `${shown} exited ${String(r.status)}: ${(r.stderr || r.stdout).trim()}` };
  return { ok: true, detail: shown };
}

/** The launchd domain of this account's login session. */
function domain(): string {
  return `gui/${process.getuid?.() ?? 0}`;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** One ExecStart word: quoted, with the characters systemd would expand escaped (systemd.service(5), "Command lines"). */
function systemdQuote(s: string): string {
  return `"${systemdPath(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '$$$$')}"`;
}

/** A path in a unit file, with the specifier character escaped (systemd.unit(5), "Specifiers"). */
function systemdPath(s: string): string {
  return s.replace(/%/g, '%%');
}
