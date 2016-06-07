/* eslint-env mocha */
'use strict';

const Path = require('path');
const winston = require('winston');

global.Config = require('nconf')
  .argv()
  .env()
  .file(Path.resolve(__dirname, './data/config.json'))
  .defaults(require('../config/defaults.json'));

// Need to disable console logging for these tests to filter out the chaff from meaningful test output
global.Log = require('../lib/logger').attach(global.Config.get('log:level'));
global.Log.remove(winston.transports.Console);
