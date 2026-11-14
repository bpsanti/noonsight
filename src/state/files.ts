import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Replace a file in one step: write a hidden temporary file next to it, then rename it over the
 * target. A reader, such as Claude Code watching its settings, sees the old content or the new
 * content and never a partial file. The temporary name starts with a dot and does not end in
 * .json, so Claude Code never reads it from a managed-settings.d directory.
 */
export function writeFileAtomic(file: string, content: string, mode: number): void {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
  fs.writeFileSync(tmp, content, { mode, flag: 'wx' });
  try {
    fs.chmodSync(tmp, mode);
    fs.renameSync(tmp, file);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

/** The file's permission bits, or the fallback when the file does not exist. */
export function modeOf(file: string, fallback: number): number {
  try {
    return fs.statSync(file).mode & 0o777;
  } catch {
    return fallback;
  }
}

/** A permission error: the directory or file cannot be written by this account. */
export function isPermissionError(e: unknown): boolean {
  const code = (e as NodeJS.ErrnoException | undefined)?.code;
  return code === 'EACCES' || code === 'EPERM' || code === 'EROFS';
}

export function readJsonFile(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

/**
 * Create a directory and any missing parents with exactly this mode. The mode is set after each
 * directory is created, so a restrictive umask (such as 077 under sudo) cannot hide a directory that
 * every account must be able to read.
 */
export function mkdirWithMode(dir: string, mode: number): void {
  const missing: string[] = [];
  for (let d = path.resolve(dir); !fs.existsSync(d); d = path.dirname(d)) {
    missing.unshift(d);
    if (path.dirname(d) === d) break;
  }
  for (const d of missing) {
    fs.mkdirSync(d, { mode });
    fs.chmodSync(d, mode);
  }
}
