// Overlapping scopes: two scopes a single task can fall in. noonsight still picks one, by fixed rules
// (scope.ts), but the person declared two scopes for the same task, and `noonsight check` says so.
//
// Two scopes overlap when a text that one scope's matcher matches is also matched by the other's.
// That text is the evidence: it comes from the examples regex-sample.ts builds, each of which really
// matches. A matcher whose examples are incomplete cannot be fully tested, so it is reported.
import { regexSamples } from './regex-sample.js';
import { taskScope, taskText } from './scope.js';
import { MATCHER_FLAGS } from './types.js';
export function scopeOverlaps(config) {
    const scopes = [...config.scopes.values()];
    const overlaps = [];
    const untested = [];
    const samples = new Map();
    for (const s of scopes) {
        const all = [];
        for (const m of s.match) {
            const found = regexSamples(m.source, MATCHER_FLAGS);
            if (!found.complete)
                untested.push({ scope: s.name, matcher: m.source });
            all.push(...found.texts);
        }
        samples.set(s, all);
    }
    scopes.forEach((a, i) => {
        for (const b of scopes.slice(i + 1)) {
            const text = witness(samples.get(a) ?? [], b) ?? witness(samples.get(b) ?? [], a);
            if (text === undefined)
                continue;
            overlaps.push({ scopes: [a.name, b.name], text, winner: taskScope(config, taskText(null, text).text).scope });
        }
    });
    return { overlaps, matchers: scopes.reduce((n, s) => n + s.match.length, 0), untested };
}
/** The first example text that one of the scope's matchers also matches. */
function witness(texts, scope) {
    return texts.find((t) => scope.match.some((m) => m.regex.test(t)));
}
//# sourceMappingURL=overlap.js.map