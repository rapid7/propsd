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

global.Config = require('../lib/config').load(args.cf);
global.Log = require('../lib/logger').attach(global.Config);

const host = Config.get('service:hostname');
const port = Config.get('service:port');
const app = express();
const server = http.createServer(app);

require('../lib/control/v1/core').attach(app);
require('../lib/control/v1/conqueso').attach(app);

server.listen(port, host, () => {
  Log.info('Listening on ' + host + ':' + port);
});
