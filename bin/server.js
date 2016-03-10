#!/usr/bin/env node

/* global Config, Log */
'use strict';

const args = require('yargs')
  .usage('Usage: $0 [args]')
  .option('c', {
    alias: 'config',
    describe: 'Load configuration from file',
    type: 'string'
  })
  .help('help')
  .argv;

const express = require('express');
const http = require('http');
const Path = require('path');

// Load nconf into the global namespace
global.Config = require('nconf')
    .env()
    .argv();
if (args.c) {
  global.Config.file(Path.resolve(process.cwd(), args.c));
}
global.Config.defaults(require('../config/defaults.json'));

global.Log = require('../lib/logger').attach(global.Config);
const PluginManager = require('../lib/plugin-manager');

const host = Config.get('service:hostname');
const port = Config.get('service:port');
const app = express();
const server = http.createServer(app);
const storage = new (require('../lib/storage'))();
const manager = new PluginManager(storage);

manager.on('error', (err) => {
  Log.error(err);
});

server.on('error', (err) => {
  Log.error(err);
});

manager.initialize();

require('../lib/control/v1/core').attach(app, storage, manager);
require('../lib/control/v1/conqueso').attach(app, storage);

server.listen(port, host, () => {
  Log.info(`Listening on ${host}:${port}`);
});
