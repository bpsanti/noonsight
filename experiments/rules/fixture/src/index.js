// Starts the clock: one tick a minute, and the tide sync.

import { tick } from './scheduler.js';
import { loadSettings } from './settings.js';
import { startSync } from './jobs/sync.js';

const send = (message) => console.log(new Date().toISOString(), message);

setInterval(() => tick(loadSettings(), new Date(), send), 60 * 1000);
startSync(send);
