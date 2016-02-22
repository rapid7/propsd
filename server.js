#!/usr/bin/env node
'use strict';

const express = require('express');
const http = require('http');

const config = require('./lib/config').load();
const logger = require('./lib/logger').attach(config);

const host = config.get('service:hostname');
const port = config.get('service:port');
const app = express();
const server = http.createServer(app);

require('./lib/control/v1/core').attach(app);
require('./lib/control/v1/conqueso').attach(app);

server.listen(port, host, () => {
  logger.info('Listening on ' + host + ':' + port);
});
