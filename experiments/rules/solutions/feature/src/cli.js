import { quote } from './quote.js';

/** The flags that take no value. */
const SWITCHES = new Set(['express']);

/** Parses "--name value" pairs, and the switches, which stand alone. */
export function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`);
    const name = arg.slice(2);
    options[name] = SWITCHES.has(name) ? true : argv[++i];
  }
  return options;
}

/** Runs the command line; returns the exit code. */
export function main(argv, out = console.log, err = console.error) {
  try {
    const options = parseArgs(argv);
    const q = quote({ weightKg: Number(options.weight), zone: Number(options.zone), express: options.express === true });
    out(`Zone ${q.zone}, ${q.weightKg} kg${q.express ? ', express' : ''}: ${q.price}`);
    return 0;
  } catch (e) {
    err(e.message);
    return 1;
  }
}
