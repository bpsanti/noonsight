// The command line: orchard <command> <file> [flags].

import fs from 'node:fs';
import { blockTotals, formatBlocks } from './blocks.js';
import { parseLog } from './parse.js';
import { formatSummary, summarize } from './summary.js';

const USAGE = 'usage: orchard summary <file> [--from YYYY-MM-DD] [--to YYYY-MM-DD]\n       orchard blocks <file>';

/** The flags after the file, as a map of name to value. */
function flags(args, known) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !known.includes(name)) throw new Error(`unknown argument: ${args[i]}`);
    const value = args[++i];
    if (value === undefined) throw new Error(`--${name} needs a value`);
    out[name] = value;
  }
  return out;
}

/**
 * @param {string[]} argv the arguments after the program name
 * @param {(line: string) => void} out
 * @param {(line: string) => void} err
 * @returns {number} the exit code
 */
export function main(argv, out = console.log, err = console.error) {
  const [command, file, ...rest] = argv;
  try {
    if (!file) throw new Error(USAGE);
    if (command === 'summary') {
      const f = flags(rest, ['from', 'to']);
      out(formatSummary(summarize(parseLog(fs.readFileSync(file, 'utf8')), { from: f.from, to: f.to })));
      return 0;
    }
    if (command === 'blocks') {
      flags(rest, []);
      out(formatBlocks(blockTotals(parseLog(fs.readFileSync(file, 'utf8')))));
      return 0;
    }
    throw new Error(USAGE);
  } catch (e) {
    err(e.message);
    return 2;
  }
}
