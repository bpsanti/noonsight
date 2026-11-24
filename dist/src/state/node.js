// The Node.js the plugin's hooks run on. A Claude Code that was not started from a shell may have no
// `node` on its PATH, so each hook the plugin runs records the one it runs on, and the plugin's launcher
// (scripts/noonsight) looks there before it searches.
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../config/paths.js';
import { writeFileAtomic } from './files.js';
export function nodeFile(home) {
    return path.join(dataDir(home), 'node');
}
/** The Node.js recorded, or null when none is recorded or it can no longer be run. */
export function recordedNode(home) {
    try {
        const node = fs.readFileSync(nodeFile(home), 'utf8').trim();
        fs.accessSync(node, fs.constants.X_OK);
        return node === '' ? null : node;
    }
    catch {
        return null;
    }
}
/** Record this Node.js, unless one that can be run is recorded already. A failure only costs the search again. */
export function recordNode(home, node) {
    try {
        if (recordedNode(home) !== null)
            return;
        const file = nodeFile(home);
        fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o755 });
        writeFileAtomic(file, `${node}\n`, 0o644);
    }
    catch {
        // The launcher searches again.
    }
}
//# sourceMappingURL=node.js.map