import { quote } from './quote.js';

/** Parses "--name value" pairs. */
export function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`);
    options[arg.slice(2)] = argv[++i];
  }
  return options;
}

/** Runs the command line; returns the exit code. */
export function main(argv, out = console.log, err = console.error) {
  try {
    const options = parseArgs(argv);
    const q = quote({ weightKg: Number(options.weight), zone: Number(options.zone) });
    out(`Zone ${q.zone}, ${q.weightKg} kg: ${q.price}`);
    return 0;
  } catch (e) {
    err(e.message);
    return 1;
  }
}
