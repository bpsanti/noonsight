// The hook pointer: a small shell script at a fixed path that Claude Code's settings call. It runs
// the installed copy of noonsight by absolute paths, so the hook does not depend on the PATH of
// whatever started Claude Code. Reinstalling or updating noonsight rewrites only this file; the
// settings entries that call it never change.
import fs from 'node:fs';
export function pointerScript(t) {
    return [
        '#!/bin/sh',
        `# noonsight hook pointer, written by \`noonsight install\`.`,
        '# Claude Code settings run this file; it runs the installed copy of noonsight.',
        `# kind: ${t.kind}`,
        `# version: ${t.version}`,
        `node=${shellQuote(t.node)}`,
        `cli=${shellQuote(t.cli)}`,
        'if [ -x "$node" ] && [ -f "$cli" ]; then',
        `  exec "$node" "$cli" hook --install ${t.kind} "$@"`,
        'fi',
        '# The installed copy is gone. A hook never holds the session, so exit quietly;',
        '# `noonsight check` reports the missing copy.',
        'exit 0',
        '',
    ].join('\n');
}
/** The target a pointer file runs, or null when the file is missing or was not written by noonsight. */
export function readPointer(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    }
    catch {
        return null;
    }
    const field = (re) => re.exec(text)?.[1];
    const node = field(/^node=('(?:[^']|'\\'')*')$/m);
    const cli = field(/^cli=('(?:[^']|'\\'')*')$/m);
    const kind = field(/^# kind: (managed|account)$/m);
    const version = field(/^# version: (\S+)$/m);
    if (!node || !cli || !kind || !version)
        return null;
    return { node: shellUnquote(node), cli: shellUnquote(cli), kind: kind, version };
}
function shellQuote(s) {
    return `'${s.replace(/'/g, `'\\''`)}'`;
}
function shellUnquote(s) {
    return s.slice(1, -1).replace(/'\\''/g, "'");
}
//# sourceMappingURL=pointer.js.map