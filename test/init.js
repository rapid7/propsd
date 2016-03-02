/* eslint-env mocha */
'use strict';

const Path = require('path');
const winston = require('winston');
const server = require('./utils/test-metadata-server');

// Need to disable console logging for these tests to filter out the chaff from meaningful test output
global.Config = require('../lib/config').load(Path.resolve(__dirname, './data/config.json'));
global.Log = require('../lib/logger').attach(global.Config);
global.Log.remove(winston.transports.Console);

before(function globalBefore() {
  server.start();
});

after(function globalAfter() {
  server.stop();
});
