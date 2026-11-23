// noonsight installed as a Claude Code plugin, for the benchmark and the live tests: the npm package as it
// would be published (`npm pack`), in a local marketplace, installed with Claude Code's own commands into
// one configuration directory. Nothing reaches a registry or the network.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN_NAME } from '../../src/adapters/claude-code/plugins.js';

/** What delivers in a session: the hooks `noonsight install` writes, the plugin, or both at once. */
export const INSTALLS = ['settings', 'plugin', 'both'] as const;
export type Install = (typeof INSTALLS)[number];

const PLUGIN_ID = `${PLUGIN_NAME}@${PLUGIN_NAME}`;
const built = new Map<string, string>();

/** A local marketplace that lists the package of a noonsight build as a plugin; built once per build and folder. */
export function marketplaceFor(noonsightRoot: string, workRoot: string): string {
  const key = `${noonsightRoot}\0${workRoot}`;
  const known = built.get(key);
  if (known !== undefined) return known;
  const dir = fs.mkdtempSync(path.join(workRoot, 'marketplace-'));
  const packed = spawnSync('npm', ['pack', '--silent', '--pack-destination', dir, noonsightRoot], { cwd: dir, encoding: 'utf8' });
  const tarball = fs.readdirSync(dir).find((f) => f.endsWith('.tgz'));
  if (packed.status !== 0 || tarball === undefined) throw new Error(`npm pack ${noonsightRoot} failed: ${packed.stderr}`);
  const plugin = path.join(dir, 'plugin');
  fs.mkdirSync(plugin);
  const extracted = spawnSync('tar', ['-xzf', path.join(dir, tarball), '--strip-components', '1', '-C', plugin], { encoding: 'utf8' });
  if (extracted.status !== 0) throw new Error(`tar failed: ${extracted.stderr}`);
  const manifest = path.join(plugin, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(manifest)) throw new Error(`the noonsight build in ${noonsightRoot} is not a plugin: it has no ${path.relative(plugin, manifest)}`);
  fs.mkdirSync(path.join(dir, '.claude-plugin'));
  fs.writeFileSync(
    path.join(dir, '.claude-plugin', 'marketplace.json'),
    JSON.stringify({ name: PLUGIN_NAME, owner: { name: 'noonsight benchmark' }, plugins: [{ name: PLUGIN_NAME, source: './plugin' }] }),
  );
  built.set(key, dir);
  return dir;
}

/** Install the plugin into one configuration directory, for the account with that home. */
export function installPlugin(claude: string, marketplace: string, where: { readonly home: string; readonly claudeDir: string; readonly cwd: string }): void {
  for (const args of [
    ['plugin', 'marketplace', 'add', marketplace],
    ['plugin', 'install', PLUGIN_ID],
  ]) {
    const r = spawnSync(claude, args, {
      cwd: where.cwd,
      env: {
        PATH: process.env.PATH ?? '',
        HOME: where.home,
        CLAUDE_CONFIG_DIR: where.claudeDir,
        DISABLE_AUTOUPDATER: '1',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        // Nothing here asks the API; a request that did would be refused, not sent.
        ANTHROPIC_BASE_URL: 'http://127.0.0.1:9',
        CLAUDE_CODE_OAUTH_TOKEN: 'noonsight-delivery-bench-placeholder',
      },
      encoding: 'utf8',
      timeout: 120_000,
    });
    if (r.status !== 0) throw new Error(`claude ${args.join(' ')} failed: ${r.stdout}${r.stderr}`);
  }
}
