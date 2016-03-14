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
global.Log = Logger.attach(global.Config);

// Add request logging middleware
app.use(Logger.logRequests({write: (message) => global.Log.info(message)}));

// Initialize the Plugin Manager and storage layer
const PluginManager = require('../lib/plugin-manager');
const storage = new (require('../lib/storage'))();
const manager = new PluginManager(storage, {});

manager.on('error', (err) => global.Log.error(err));
manager.initialize();

// Register endpoints
require('../lib/control/v1/core').attach(app, storage, manager);
require('../lib/control/v1/conqueso').attach(app, storage);

// Instantiate server and start it
const host = Config.get('service:hostname');
const port = Config.get('service:port');
const server = http.createServer(app);

server.on('error', (err) => global.Log.error(err));

server.listen(port, host, () => {
  Log.info(`Listening on ${host}:${port}`);
});
