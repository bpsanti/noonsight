import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PACKAGE_ROOT } from '../src/config/paths.js';

export const FIXTURES = path.join(PACKAGE_ROOT, 'test', 'fixtures');
export const LAB_CONFIG = path.join(FIXTURES, 'lab', 'config', 'noonsight.json');
export const LAB_PRESETS = path.join(FIXTURES, 'lab', 'presets');
export const CLI = path.join(PACKAGE_ROOT, 'dist', 'src', 'cli.js');

/** A fresh temporary directory holding the given files; JSON values are serialized. */
export function tempTree(files: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-test-'));
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return dir;
}

/** Copy the lab preset into a temporary presets directory and apply edits to its preset.json. */
export function labPresetWith(edit: (preset: Record<string, any>) => void): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-presets-'));
  fs.cpSync(LAB_PRESETS, dir, { recursive: true });
  const file = path.join(dir, 'lab', 'preset.json');
  const preset = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, any>;
  edit(preset);
  fs.writeFileSync(file, JSON.stringify(preset, null, 2));
  return dir;
}

export interface CliResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Run the built command line with an environment that holds only what the test passes, so the
 * machine's own configuration can never leak in. HOME points at an empty directory by default.
 */
export function runCli(
  args: readonly string[],
  env: Record<string, string> = {},
  nodeArgs: readonly string[] = [],
  input = '',
): CliResult {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-home-'));
  const r = spawnSync(process.execPath, [...nodeArgs, CLI, ...args], {
    encoding: 'utf8',
    input,
    env: { PATH: process.env.PATH ?? '', HOME: home, ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** Run any program the same way, such as an installed hook pointer. */
export function runProgram(file: string, args: readonly string[], env: Record<string, string>, input = ''): CliResult {
  const r = spawnSync(file, [...args], { encoding: 'utf8', input, env: { PATH: process.env.PATH ?? '', ...env } });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** A directory holding a fake `claude` that reports the given version, to put on PATH. */
export function fakeClaude(version: string): string {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-bin-'));
  fs.writeFileSync(path.join(bin, 'claude'), `#!/bin/sh\necho '${version} (Claude Code)'\n`, { mode: 0o755 });
  return bin;
}

/** The Claude Code version each recorded hook input comes from, when it is not 2.1.325. */
const INPUT_VERSIONS: Readonly<Record<string, string>> = { 'subagent-start': '2.1.326' };

/** A recorded or documented Claude Code hook input, with fields replaced as given. */
export function hookInput(name: string, fields: Record<string, unknown> = {}): string {
  const file = path.join(FIXTURES, 'hook-inputs', INPUT_VERSIONS[name] ?? '2.1.325', `${name}.json`);
  return JSON.stringify({ ...(JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>), ...fields });
}

/** Node options that end the process with a marker on stderr at any attempt to reach the network. */
export const NO_NETWORK = ['--require', path.join(FIXTURES, 'no-network.cjs')];

export interface HookHome {
  readonly env: Record<string, string>;
  readonly dir: string;
  hook(event: string, input: string, extra?: Record<string, string>): { status: number | null; out: Record<string, any> | null; raw: string };
  log(): Record<string, any>[];
}

/**
 * A home directory of its own, so the decision log and the records start empty, in which to run the
 * hook as Claude Code runs it: a separate process that gets the hook input on stdin.
 */
export function hookHome(config: string = LAB_CONFIG, extraEnv: Record<string, string> = {}): HookHome {
  const dir = tempTree({});
  // The system root keeps this machine's own managed settings out of the model lookup.
  const env = { HOME: dir, NOONSIGHT_CONFIG: config, NOONSIGHT_PRESETS_DIR: LAB_PRESETS, NOONSIGHT_SYSTEM_ROOT: tempTree({}), ...extraEnv };
  return {
    env,
    dir,
    hook(event, input, extra = {}) {
      const r = runCli(['hook', event], { ...env, ...extra }, NO_NETWORK, input);
      assert.equal(r.stderr, '', r.stderr);
      return { status: r.status, out: r.stdout ? (JSON.parse(r.stdout) as Record<string, any>) : null, raw: r.stdout };
    },
    log() {
      const file = path.join(dir, '.local', 'state', 'noonsight', 'decisions.jsonl');
      if (!fs.existsSync(file)) return [];
      return fs
        .readFileSync(file, 'utf8')
        .trimEnd()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, any>);
    },
  };
}
