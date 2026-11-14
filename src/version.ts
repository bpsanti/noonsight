import fs from 'node:fs';
import path from 'node:path';
import { PACKAGE_ROOT } from './config/paths.js';

/** The installed package version, as package.json states it. */
export function packageVersion(): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string };
  return pkg.version;
}

/** Compare two number.number.number versions; null when either cannot be read. */
export function compareVersions(a: string, b: string): number | null {
  const parse = (v: string): number[] | null => {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}
