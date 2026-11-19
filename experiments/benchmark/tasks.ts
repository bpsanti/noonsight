// The pilot's Harbor tasks, written from the downloaded sources. Each set has its own small change:
//
// - build: the SWE-bench Verified task as Harbor ships it, with its x86_64 image swapped for the
//   instance's native arm64 image; the tests, the verifier and the reference patch stay as they are.
// - routine: the Terminal-Bench 2.1 task; when its prebuilt image has no arm64 variant (most exist
//   only for amd64), without that image, so Harbor builds the task's own Dockerfile for this machine.
// - digest: a new task on an instance's arm64 image: summarize the issue and its discussion.
// - investigate (SWE Atlas) and review (ReviewBench): the upstream task, with its verifier swapped for
//   a check that the answer file exists; the upstream grading files are kept beside the task and the
//   answer is graded afterwards by the pilot's judge (judge.ts).
//
// Open tasks write their answer to a file under /logs/agent, which Harbor copies out with the run.

import fs from 'node:fs';
import path from 'node:path';
import { swebenchImage, tomlValue, treeHash } from './sources.js';

export type SetName = 'build' | 'routine' | 'digest' | 'investigate' | 'review';
export const SETS: readonly SetName[] = ['build', 'routine', 'digest', 'investigate', 'review'];
export const OPEN_SETS: readonly SetName[] = ['digest', 'investigate', 'review'];

/** Where each set's answer lands in the container, for the open sets. */
export const ANSWER_FILE: Readonly<Partial<Record<SetName, string>>> = {
  digest: '/logs/agent/digest.md',
  investigate: '/logs/agent/answer.txt',
  review: '/work/out/findings.json',
};

export interface Sources {
  /** `harbor download swebench-verified@1.0` */
  readonly swebench: string;
  /** `harbor download terminal-bench/terminal-bench-2-1` */
  readonly terminalBench: string;
  /** `harbor download review-bench/reviewbench-public@v1` */
  readonly reviewBench: string;
  /** A checkout of scaleapi/SWE-Atlas at the pinned commit. */
  readonly sweAtlas: string;
  /** The issue text and discussion of the digest instances, by instance id. */
  readonly threads: ReadonlyMap<string, { readonly problem_statement: string; readonly hints_text: string }>;
}

export interface Materialized {
  readonly set: SetName;
  readonly id: string;
  /** The Harbor task directory. */
  readonly dir: string;
  /** sha256 of the task directory as written, recorded in every result line. */
  readonly sha256: string;
  /** The upstream grading files of an open task, for the judge. */
  readonly grading?: string;
}

/**
 * Write one task into `<work>/tasks/<set>/<id>` (and its grading files into `<work>/grading/<set>/<id>`).
 * `hasArm64` tells whether a routine task's prebuilt image can run here as it is.
 */
export function materialize(set: SetName, id: string, src: Sources, work: string, hasArm64: (image: string) => boolean = () => false): Materialized {
  const dir = path.join(work, 'tasks', set, id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  let grading: string | undefined;
  switch (set) {
    case 'build':
      fs.cpSync(path.join(src.swebench, id), dir, { recursive: true });
      useArm64Image(dir, id);
      break;
    case 'routine': {
      fs.cpSync(path.join(src.terminalBench, id), dir, { recursive: true });
      const toml = path.join(dir, 'task.toml');
      const image = tomlValue(fs.readFileSync(toml, 'utf8'), 'docker_image', 'environment');
      if (image !== null && !hasArm64(image)) fs.writeFileSync(toml, dropKey(fs.readFileSync(toml, 'utf8'), 'docker_image', 'environment'));
      break;
    }
    case 'digest':
      writeDigestTask(dir, id, src);
      break;
    case 'investigate':
    case 'review': {
      const from = set === 'investigate' ? path.join(src.sweAtlas, 'data', 'qa', id) : reviewTaskDir(src.reviewBench, id);
      fs.cpSync(from, dir, { recursive: true });
      if (set === 'review') unpinBase(dir);
      grading = path.join(work, 'grading', set, id);
      fs.rmSync(grading, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(grading), { recursive: true });
      fs.renameSync(path.join(dir, 'tests'), grading);
      writeAnswerCheck(dir, ANSWER_FILE[set] as string);
      const toml = path.join(dir, 'task.toml');
      // The upstream verifier runs apart and needs a judge key; the answer check runs in the task's own container.
      const upstream = fs.readFileSync(toml, 'utf8');
      fs.writeFileSync(toml, dropSection(dropSection(upstream, 'verifier.env'), 'verifier.environment').replace(/^environment_mode = "separate"\n/m, ''));
      break;
    }
  }
  return { set, id, dir, sha256: treeHash(dir), ...(grading ? { grading } : {}) };
}

/**
 * Let a review task's image build for this machine: ReviewBench pins its base, a multi-architecture
 * Node.js image, to the digest of its amd64 variant, and Claude Code's own binary does not run under
 * amd64 emulation here, so the digest goes and the tag picks the native variant.
 */
export function unpinBase(dir: string): void {
  const file = path.join(dir, 'environment', 'Dockerfile');
  const text = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, text.replace(/^(FROM\s+[^\s@]+)@sha256:[0-9a-f]{64}/m, '$1'));
}

/** Point a SWE-bench task's Dockerfile at the instance's arm64 image. */
export function useArm64Image(dir: string, instanceId: string): void {
  const file = path.join(dir, 'environment', 'Dockerfile');
  const x86 = `FROM ${swebenchImage(instanceId, 'x86_64')}:latest`;
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(x86)) throw new Error(`${file} does not start from ${x86}`);
  fs.writeFileSync(file, text.replace(x86, `FROM ${swebenchImage(instanceId, 'arm64')}:latest`));
}

/** The ReviewBench task directory of a PR key such as `sdsykes_fastimage_165`. */
export function reviewTaskDir(root: string, prKey: string): string {
  const matches = fs.readdirSync(root).filter((d) => d.startsWith(`rb-public-${prKey}-`));
  if (matches.length !== 1) throw new Error(`expected one ReviewBench task for ${prKey} in ${root}, found ${matches.length}`);
  return path.join(root, matches[0] as string);
}

/** A task.toml without one `key = value` line of a section. */
export function dropKey(toml: string, key: string, section: string): string {
  let current = '';
  return toml
    .split('\n')
    .filter((line) => {
      const header = /^\[([^\]]+)\]\s*$/.exec(line.trim());
      if (header) current = header[1] ?? '';
      return !(current === section && new RegExp(`^${key}\\s*=`).test(line.trim()));
    })
    .join('\n');
}

/** A task.toml without one whole section. */
export function dropSection(toml: string, section: string): string {
  let skipping = false;
  return toml
    .split('\n')
    .filter((line) => {
      const header = /^\[([^\]]+)\]\s*$/.exec(line.trim());
      if (header) skipping = header[1] === section;
      return !skipping;
    })
    .join('\n');
}

/** A verifier that only checks that the answer was written: reward 1 when the file is there and not empty. */
function writeAnswerCheck(dir: string, answer: string): void {
  fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'tests', 'test.sh'),
    `#!/bin/bash\n# The answer is graded after the run, by the pilot's judge; this only records whether it was written.\nmkdir -p /logs/verifier\nif [ -s ${answer} ]; then echo 1 > /logs/verifier/reward.txt; else echo 0 > /logs/verifier/reward.txt; fi\n`,
    { mode: 0o755 },
  );
}

export const DIGEST_INSTRUCTION = `<uploaded_files>
/testbed
</uploaded_files>
The repository in /testbed is at the commit where the issue below was reported. The maintainers asked for a summary of the issue and its discussion that a maintainer who has not read the thread can act on.

<issue>
{problem_statement}
</issue>

<discussion>
{hints_text}
</discussion>

Write that summary: what the problem is, the proposals made in the discussion, what was agreed, and what is still open. You may read the code to make it accurate. Do not change any file in the repository, and work only from the repository and the text above; do not look up the issue or its fix online.

Write the summary in Markdown to /logs/agent/digest.md:

\`\`\`bash
mkdir -p /logs/agent
cat <<'DIGEST_EOF' > /logs/agent/digest.md
...your summary...
DIGEST_EOF
\`\`\`
`;

/** A digest task: the build task's arm64 environment, a new instruction, and the answer check. */
function writeDigestTask(dir: string, instanceId: string, src: Sources): void {
  const thread = src.threads.get(instanceId);
  if (!thread) throw new Error(`no issue thread for digest instance ${instanceId}`);
  const from = path.join(src.swebench, instanceId);
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(path.join(from, 'environment'), path.join(dir, 'environment'), { recursive: true });
  useArm64Image(dir, instanceId);
  fs.writeFileSync(
    path.join(dir, 'instruction.md'),
    DIGEST_INSTRUCTION.replace('{problem_statement}', () => thread.problem_statement.trim()).replace('{hints_text}', () => thread.hints_text.trim()),
  );
  const toml = fs.readFileSync(path.join(from, 'task.toml'), 'utf8');
  fs.writeFileSync(
    path.join(dir, 'task.toml'),
    [
      '[metadata]',
      `source_instance = "${instanceId}"`,
      `difficulty = "${tomlValue(toml, 'difficulty', 'metadata') ?? ''}"`,
      'category = "digest"',
      '',
      '[verifier]',
      'timeout_sec = 120',
      '',
      '[agent]',
      'timeout_sec = 1800',
      '',
      '[environment]',
      `build_timeout_sec = ${tomlValue(toml, 'build_timeout_sec', 'environment') ?? '1800.0'}`,
      'cpus = 1',
      "memory = '4G'",
      "storage = '10G'",
      '',
    ].join('\n'),
  );
  // The reference "solution" proves only that the environment starts and the answer path is writable.
  fs.mkdirSync(path.join(dir, 'solution'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'solution', 'solve.sh'), '#!/bin/bash\nmkdir -p /logs/agent\necho "Environment check: no summary." > /logs/agent/digest.md\n', { mode: 0o755 });
  writeAnswerCheck(dir, ANSWER_FILE.digest as string);
}
