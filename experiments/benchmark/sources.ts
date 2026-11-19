// Where the task metadata comes from, and the content hash that pins each task. The SWE-bench Verified
// rows come from the Hugging Face datasets server, the arm64 images from Docker Hub, and the task
// directories from `harbor download`. Only ids, hashes and the derived lists are committed: the
// dataset itself declares no license, so it is fetched, never copied into the repository.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SwebenchInstance, TerminalBenchTask } from './select.js';

const ROWS_URL = 'https://datasets-server.huggingface.co/rows?dataset=princeton-nlp/SWE-bench_Verified&config=default&split=test';
const HUB_TAG_URL = 'https://hub.docker.com/v2/repositories/swebench';

/** The Docker Hub repository of an instance's evaluation image for one architecture. */
export function swebenchImage(instanceId: string, arch: 'x86_64' | 'arm64'): string {
  return `swebench/sweb.eval.${arch}.${instanceId.replace('__', '_1776_')}`;
}

/** GET a JSON document, retrying errors; Docker Hub limits anonymous lookups, so a 429 waits longer. */
async function getJson(url: string): Promise<{ status: number; body: any }> {
  for (let attempt = 1; ; attempt++) {
    let wait = 2000 * attempt;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (r.status === 404) return { status: 404, body: null };
      if (r.ok) return { status: r.status, body: await r.json() };
      if (attempt >= 10) throw new Error(`${url}: HTTP ${r.status}`);
      if (r.status === 429) wait = 1000 * Math.max(15 * attempt, Number(r.headers.get('retry-after') ?? 0));
    } catch (e) {
      if (attempt >= 10) throw e;
    }
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

/** Download the 500 rows of SWE-bench Verified into `dir` as rows-<offset>.json. */
export async function fetchSwebenchRows(dir: string): Promise<void> {
  fs.mkdirSync(dir, { recursive: true });
  for (let offset = 0; offset < 500; offset += 100) {
    const { body } = await getJson(`${ROWS_URL}&offset=${offset}&length=100`);
    fs.writeFileSync(path.join(dir, `rows-${offset}.json`), JSON.stringify(body));
  }
}

/** The fields the selection uses, from rows fetched by fetchSwebenchRows. */
export function readSwebenchRows(dir: string): (SwebenchInstance & { problem_statement: string; hints_text: string })[] {
  const rows = fs
    .readdirSync(dir)
    .filter((f) => /^rows-\d+\.json$/.test(f))
    .flatMap((f) => (JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).rows as { row: Record<string, string> }[]).map((r) => r.row));
  if (rows.length !== 500) throw new Error(`expected the 500 rows of SWE-bench Verified in ${dir}, found ${rows.length}`);
  return rows.map((r) => ({
    instance_id: String(r.instance_id),
    repo: String(r.repo),
    difficulty: String(r.difficulty),
    hints_chars: String(r.hints_text ?? '').length,
    problem_statement: String(r.problem_statement ?? ''),
    hints_text: String(r.hints_text ?? ''),
  }));
}

/** The instances whose arm64 evaluation image has a `latest` tag built for arm64, a few lookups at a time. */
export async function arm64Instances(ids: readonly string[], concurrency = 3): Promise<string[]> {
  const found: string[] = [];
  const queue = [...ids];
  const worker = async (): Promise<void> => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      const repo = swebenchImage(id, 'arm64').split('/')[1];
      const { status, body } = await getJson(`${HUB_TAG_URL}/${repo}/tags/latest`);
      if (status === 404) continue;
      if (((body?.images ?? []) as { architecture?: string }[]).some((i) => i.architecture === 'arm64')) found.push(id);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return found.sort();
}

/** Whether a public Docker Hub image (`repo:tag`) has a variant built for arm64. */
export async function hubImageHasArm64(image: string): Promise<boolean> {
  const at = image.lastIndexOf(':');
  const repo = at > image.indexOf('/') ? image.slice(0, at) : image;
  const tag = at > image.indexOf('/') ? image.slice(at + 1) : 'latest';
  const { status, body } = await getJson(`https://hub.docker.com/v2/repositories/${repo.includes('/') ? repo : `library/${repo}`}/tags/${tag}`);
  return status !== 404 && ((body?.images ?? []) as { architecture?: string }[]).some((i) => i.architecture === 'arm64');
}

/** One `key = value` from a task.toml, within a [section] when given; enough for Harbor's flat task files. */
export function tomlValue(text: string, key: string, section?: string): string | null {
  let current = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) {
      current = header[1] ?? '';
      continue;
    }
    const m = /^([A-Za-z0-9_]+)\s*=\s*(.+)$/.exec(line);
    if (m && m[1] === key && (section === undefined || current === section)) return (m[2] ?? '').replace(/\s+#.*$/, '').replace(/^["']|["']$/g, '');
  }
  return null;
}

/** The Terminal-Bench tasks of a dataset directory from `harbor download`. */
export function readTerminalBench(dir: string): TerminalBenchTask[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'task.toml')))
    .map((d) => {
      const toml = fs.readFileSync(path.join(dir, d.name, 'task.toml'), 'utf8');
      const expert = tomlValue(toml, 'expert_time_estimate_min', 'metadata');
      return {
        id: d.name,
        expert_time_estimate_min: expert === null ? null : Number(expert),
        agent_timeout_sec: Number(tomlValue(toml, 'timeout_sec', 'agent') ?? Infinity),
        memory_mb: Number(tomlValue(toml, 'memory_mb', 'environment') ?? 0),
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** sha256 over a directory's files, their relative paths and contents, in path order. */
export function treeHash(dir: string): string {
  const h = createHash('sha256');
  const walk = (rel: string): void => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(r);
      else if (e.isFile()) h.update(`${r}\0`).update(fs.readFileSync(path.join(dir, r))).update('\0');
    }
  };
  walk('');
  return h.digest('hex');
}
