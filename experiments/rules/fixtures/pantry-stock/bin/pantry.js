#!/usr/bin/env node
'use strict';

const { run } = require('../src/cli.js');

process.exitCode = run(process.argv.slice(2), {
  out: (text) => process.stdout.write(`${text}\n`),
  err: (text) => process.stderr.write(`${text}\n`),
});
