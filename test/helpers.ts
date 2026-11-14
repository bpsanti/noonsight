import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PACKAGE_ROOT } from '../src/config/paths.js';

export const FIXTURES = path.join(PACKAGE_ROOT, 'test', 'fixtures');
export const LAB_CONFIG = path.join(FIXTURES, 'lab', 'config', 'sextant.json');
export const LAB_PRESETS = path.join(FIXTURES, 'lab', 'presets');
export const CLI = path.join(PACKAGE_ROOT, 'dist', 'src', 'cli.js');

/** A fresh temporary directory holding the given files; JSON values are serialized. */
export function tempTree(files: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-test-'));
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return dir;
}

/** Copy the lab preset into a temporary presets directory and apply edits to its preset.json. */
export function labPresetWith(edit: (preset: Record<string, any>) => void): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-presets-'));
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
export function runCli(args: readonly string[], env: Record<string, string> = {}, nodeArgs: readonly string[] = []): CliResult {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-home-'));
  const r = spawnSync(process.execPath, [...nodeArgs, CLI, ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', HOME: home, ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
