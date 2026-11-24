// Writes the plugin folder the Claude plugin directory reads from a branch of this repository:
// `npm run plugin-folder -- <new or empty directory>`. The directory copies committed files and runs no
// build, and this repository does not commit dist/, so the folder is the npm package, unpacked. Its one
// difference is the README, whose relative links would not resolve there: they point at the release's
// tag on GitHub instead.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const out = process.argv[2];
if (!out) {
  console.error('usage: npm run plugin-folder -- <new or empty directory>');
  process.exit(2);
}
const dir = path.resolve(out);
if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) {
  console.error(`${dir} is not empty`);
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-plugin-'));
try {
  // --ignore-scripts: the npm script that runs this has built dist/ already.
  execFileSync('npm', ['pack', '--ignore-scripts', '--silent', '--pack-destination', tmp], { cwd: ROOT, stdio: 'pipe' });
  const tarball = fs.readdirSync(tmp).find((f) => f.endsWith('.tgz'));
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('tar', ['-xzf', path.join(tmp, tarball), '-C', dir, '--strip-components', '1']);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

const { version } = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
const readme = path.join(dir, 'README.md');
const base = `https://github.com/bpsanti/noonsight/blob/v${version}/`;
fs.writeFileSync(readme, fs.readFileSync(readme, 'utf8').replace(/\]\((?!#|[a-z]+:)([^)\s]+)\)/g, `](${base}$1)`));
console.log(`noonsight ${version}: plugin folder written to ${dir}`);
