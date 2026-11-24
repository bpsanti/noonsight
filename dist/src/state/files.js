import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
/**
 * Replace a file in one step: write a hidden temporary file next to it, then rename it over the
 * target. A reader, such as Claude Code watching its settings, sees the old content or the new
 * content and never a partial file. The temporary name starts with a dot and does not end in
 * .json, so Claude Code never reads it from a managed-settings.d directory.
 */
export function writeFileAtomic(file, content, mode) {
    const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
    fs.writeFileSync(tmp, content, { mode, flag: 'wx' });
    try {
        fs.chmodSync(tmp, mode);
        fs.renameSync(tmp, file);
    }
    catch (e) {
        fs.rmSync(tmp, { force: true });
        throw e;
    }
}
/**
 * Create a file in one step, or return false when it already exists: its content is written to a hidden
 * temporary file, which is then linked to the name, so no reader sees part of it and nothing is replaced.
 */
export function createFileAtomic(file, content, mode = 0o644) {
    const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
    fs.writeFileSync(tmp, content, { mode, flag: 'wx' });
    try {
        try {
            fs.linkSync(tmp, file);
        }
        catch (e) {
            if (e.code === 'EEXIST')
                return false;
            // A file system without hard links: created in place, still without replacing anything.
            fs.writeFileSync(file, content, { mode, flag: 'wx' });
        }
        return true;
    }
    catch (e) {
        if (e.code === 'EEXIST')
            return false;
        throw e;
    }
    finally {
        fs.rmSync(tmp, { force: true });
    }
}
/** The file's permission bits, or the fallback when the file does not exist. */
export function modeOf(file, fallback) {
    try {
        return fs.statSync(file).mode & 0o777;
    }
    catch {
        return fallback;
    }
}
/** A permission error: the directory or file cannot be written by this account. */
export function isPermissionError(e) {
    const code = e?.code;
    return code === 'EACCES' || code === 'EPERM' || code === 'EROFS';
}
export function readJsonFile(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}
/**
 * Create a directory and any missing parents with exactly this mode. The mode is set after each
 * directory is created, so a restrictive umask (such as 077 under sudo) cannot hide a directory that
 * every account must be able to read.
 */
export function mkdirWithMode(dir, mode) {
    const missing = [];
    for (let d = path.resolve(dir); !fs.existsSync(d); d = path.dirname(d)) {
        missing.unshift(d);
        if (path.dirname(d) === d)
            break;
    }
    for (const d of missing) {
        fs.mkdirSync(d, { mode });
        fs.chmodSync(d, mode);
    }
}
//# sourceMappingURL=files.js.map