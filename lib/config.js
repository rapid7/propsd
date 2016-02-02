/* eslint-disable rapid7/static-magic-numbers */
const Config = global.Config = require('nconf');
const Path = require('path');

Config.file(Path.resolve(__dirname, '../config/dev.json'));

Config.defaults({
  index: {
    path: 'index.json',
    interval: 30000,
    region: 'us-east-1'
  },
  service: {
    port: 9100,
    hostname: '127.0.0.1'
  },
  log: {
    level: 'debug'
  },
  consul: {
    host: '127.0.0.1',
    port: 8500,
    secure: false
  },
  metadata: {
    host: '169.254.169.254',
    interval: 30000
  }
});