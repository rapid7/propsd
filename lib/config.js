'use strict';

const nconf = require('nconf');
const Path = require('path');

const defaults = {
  index: {
    path: 'index.json',
    interval: 30000, // eslint-disable-line rapid7/static-magic-numbers
    region: 'us-east-1'
  },
  service: {
    port: 9100, // eslint-disable-line rapid7/static-magic-numbers
    hostname: '127.0.0.1'
  },
  log: {
    level: 'debug'
  },
  consul: {
    host: '127.0.0.1',
    port: 8500, // eslint-disable-line rapid7/static-magic-numbers
    secure: false
  },
  metadata: {
    host: '169.254.169.254',
    interval: 30000 // eslint-disable-line rapid7/static-magic-numbers
  }
};

function loadConfigs(path) {
  const configs = nconf.file(path);

  configs.defaults(defaults);
  return configs;
}

exports.load = loadConfigs;
