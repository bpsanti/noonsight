// Changes one top-level string value of a JSON file's text and leaves every other character as it
// was: the user's indentation, key order and line breaks survive. `noonsight accept` uses it, since
// the configuration file is the user's own and noonsight otherwise never writes it once it exists.
import { isDeepStrictEqual } from 'node:util';
/**
 * Set the top-level `key` to the string `value`. A member that is there keeps its place and only its
 * value changes; a missing one is added right after the first of `after` that the object has, on its
 * own line with that member's indentation, or first in the object. Throws when the text is not a
 * JSON object, or when the result would differ from the parsed file by more than that one value.
 */
export function setTopLevelString(text, key, value, after) {
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        throw new Error('the file is not a JSON object');
    const { open, members } = topLevelMembers(text);
    const literal = JSON.stringify(value);
    let result;
    const own = members.filter((m) => m.key === key);
    if (own.length) {
        // JSON.parse keeps the last of duplicate keys; every one gets the value, so no reader sees another.
        result = text;
        for (const m of [...own].reverse())
            result = result.slice(0, m.valueStart) + literal + result.slice(m.valueEnd);
    }
    else {
        const anchor = after.map((name) => members.find((m) => m.key === name)).find((m) => m !== undefined);
        const first = members[0];
        if (anchor !== undefined) {
            const separator = lineBreakBefore(text, anchor.keyStart);
            result = `${text.slice(0, anchor.valueEnd)},${separator}${JSON.stringify(key)}: ${literal}${text.slice(anchor.valueEnd)}`;
        }
        else if (first !== undefined) {
            const separator = lineBreakBefore(text, first.keyStart);
            result = `${text.slice(0, first.keyStart)}${JSON.stringify(key)}: ${literal},${separator}${text.slice(first.keyStart)}`;
        }
        else {
            result = `${text.slice(0, open + 1)}${JSON.stringify(key)}: ${literal}${text.slice(open + 1)}`;
        }
    }
    const expected = { ...parsed, [key]: value };
    if (!isDeepStrictEqual(JSON.parse(result), expected))
        throw new Error(`could not set "${key}" without changing anything else in the file`);
    return result;
}
/** The whitespace that sets a member on its own line: a line break and the member's indentation, or a space. */
function lineBreakBefore(text, keyStart) {
    const lineStart = text.lastIndexOf('\n', keyStart - 1) + 1;
    const indent = text.slice(lineStart, keyStart);
    if (lineStart === 0 || !/^[ \t]*$/.test(indent))
        return ' ';
    return `${text[lineStart - 2] === '\r' ? '\r\n' : '\n'}${indent}`;
}
/** The members of the top-level object, in the order the text writes them. The text is valid JSON. */
function topLevelMembers(text) {
    let i = 0;
    const ws = () => {
        while (i < text.length && ' \t\r\n﻿'.includes(text[i] ?? ''))
            i++;
    };
    const string = () => {
        i++;
        while (text[i] !== '"')
            i += text[i] === '\\' ? 2 : 1;
        i++;
    };
    const value = () => {
        const c = text[i];
        if (c === '"')
            return string();
        if (c === '{' || c === '[') {
            let depth = 0;
            do {
                const d = text[i];
                if (d === '"') {
                    string();
                    continue;
                }
                if (d === '{' || d === '[')
                    depth++;
                else if (d === '}' || d === ']')
                    depth--;
                i++;
            } while (depth > 0);
            return;
        }
        while (i < text.length && !',}] \t\r\n'.includes(text[i] ?? ''))
            i++;
    };
    ws();
    const open = i;
    i++;
    const members = [];
    for (;;) {
        ws();
        if (text[i] === '}')
            break;
        const keyStart = i;
        string();
        const key = JSON.parse(text.slice(keyStart, i));
        ws();
        i++; // ':'
        ws();
        const valueStart = i;
        value();
        members.push({ key, keyStart, valueStart, valueEnd: i });
        ws();
        if (text[i] === ',')
            i++;
    }
    return { open, members };
}
//# sourceMappingURL=rewrite.js.map