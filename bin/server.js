#!/usr/bin/env node
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

const config = require('../lib/config').load(args.cf);
const logger = require('../lib/logger').attach(config);

const host = config.get('service:hostname');
const port = config.get('service:port');
const app = express();
const server = http.createServer(app);

require('../lib/control/v1/core').attach(app);
require('../lib/control/v1/conqueso').attach(app);

server.listen(port, host, () => {
  logger.info('Listening on ' + host + ':' + port);
});
