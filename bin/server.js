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

const deprecate = require('depd')('propsd');
const express = require('express');
const expressWinston = require('express-winston');
const http = require('http');
const Path = require('path');
const Logger = require('../lib/logger');
const app = express();

// Load nconf into the global namespace
global.Config = require('nconf')
    .env()
    .argv();

if (args.c) {
  global.Config.file(Path.resolve(process.cwd(), args.c));
}
global.Config.defaults(require('../config/defaults.json'));

// Set up logging
global.Log = Logger.attach(global.Config.get('log:level'), global.Config.get('log:filename'));

// Add request logging middleware
if (global.Config.get('log:access')) {
  deprecate('Separate logging control for access logs has been deprecated and will be removed in a later version.');
}

app.use(expressWinston.logger({
  winstonInstance: global.Log,
  expressFormat: true,
  level: global.Config.get('log:access:level') || global.Config.get('log:level'),
  baseMeta: {sourceName: 'request'}
}));

// Initialize the Plugin Manager and storage layer
const PluginManager = require('../lib/plugin-manager');
const storage = new (require('../lib/storage'))();
const manager = new PluginManager(storage, {});

manager.on('error', (err, logMetadata) => global.Log.ERROR(err, logMetadata));
manager.initialize();

// Register endpoints
require('../lib/control/v1/core').attach(app, storage, manager);
require('../lib/control/v1/conqueso').attach(app, storage);

// Instantiate server and start it
const host = Config.get('service:hostname');
const port = Config.get('service:port');
const server = http.createServer(app);

server.on('error', (err) => global.Log.ERROR(err));

server.listen(port, host, () => {
  global.Log.INFO(`Listening on ${host}:${port}`);
});
