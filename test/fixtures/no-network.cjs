// Preloaded with `node --require` by the tests: any attempt to reach the network ends the process
// with exit code 97 and a marker on stderr, so a test can prove a command never tried.
'use strict';
const blocked = (what) => () => {
  process.stderr.write(`NETWORK-ATTEMPT ${what}\n`);
  process.exit(97);
};
const net = require('node:net');
net.Socket.prototype.connect = blocked('net.Socket.connect');
net.connect = blocked('net.connect');
net.createConnection = blocked('net.createConnection');
const dns = require('node:dns');
dns.lookup = blocked('dns.lookup');
dns.resolve = blocked('dns.resolve');
dns.promises.lookup = blocked('dns.promises.lookup');
dns.promises.resolve = blocked('dns.promises.resolve');
require('node:dgram').createSocket = blocked('dgram.createSocket');
require('node:http').request = blocked('http.request');
require('node:http').get = blocked('http.get');
require('node:https').request = blocked('https.request');
require('node:https').get = blocked('https.get');
globalThis.fetch = blocked('fetch');
require('node:module').syncBuiltinESMExports();
