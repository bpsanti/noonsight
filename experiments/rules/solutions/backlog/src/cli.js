// The command line: orchard <command> <file> [flags].

import fs from 'node:fs';
import { blockTotals, formatBlocks } from './blocks.js';
import { parseLog } from './parse.js';
import { formatSummary, summarize } from './summary.js';

const USAGE = [
  'usage: orchard summary <file> [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--variety <name>] [--json]',
  '       orchard blocks <file>',
  '       orchard export-csv <file>',
].join('\n');

/** The flags after the file, as a map of name to value; a switch takes no value and maps to true. */
function flags(args, known, switches = []) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !(known.includes(name) || switches.includes(name))) throw new Error(`unknown argument: ${args[i]}`);
    if (switches.includes(name)) {
      out[name] = true;
      continue;
    }
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
      const f = flags(rest, ['from', 'to', 'variety'], ['json']);
      let records = parseLog(fs.readFileSync(file, 'utf8'));
      if (f.variety !== undefined) records = records.filter((r) => r.variety === f.variety.toLowerCase());
      const rows = summarize(records, { from: f.from, to: f.to });
      out(f.json ? JSON.stringify({ from: f.from ?? null, to: f.to ?? null, varieties: rows }) : formatSummary(rows));
      return 0;
    }
    if (command === 'blocks') {
      flags(rest, []);
      out(formatBlocks(blockTotals(parseLog(fs.readFileSync(file, 'utf8')))));
      return 0;
    }
    if (command === 'export-csv') {
      flags(rest, []);
      const records = parseLog(fs.readFileSync(file, 'utf8'));
      out(['date,block,variety,crates,weight_kg', ...records.map((r) => `${r.date},${r.block},${r.variety},${r.crates},${r.weightKg.toFixed(1)}`)].join('\n'));
      return 0;
    }
    throw new Error(USAGE);
  } catch (e) {
    err(e.message);
    return 2;
  }
}
