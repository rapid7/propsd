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
const HTTP = require('http');
const Path = require('path');
const Logger = require('../lib/logger');

const Properties = require('../lib/properties');
const Sources = require('../lib/sources');
const Consul = require('../lib/source/consul');
const Metadata = require('../lib/source/metadata');
const S3 = require('../lib/source/s3');

const app = express();
const server = HTTP.createServer(app);

// Load nconf into the global namespace
global.Config = require('nconf').env()
  .argv({
    config: {
      alias: 'c',
      default: '/etc/propsd/config.json',
      describe: 'Path to local propsd configuration'
    }
  });

if (args.c) { Config.file(Path.resolve(process.cwd(), args.c)); }
Config.defaults(require('../config/defaults.json'));

global.Log = Logger.attach(Config.get('log:level'), Config.get('log:filename'));

// Add request logging middleware
if (Config.get('log:access')) {
  deprecate('Separate logging control for access logs has been deprecated and will be removed in a later version.');
}

app.use(Logger.requests(Log, Config.get('log:access:level') || Config.get('log:level')));

const properties = new Properties();
const sources = new Sources(properties);

// Add metadata and some statics
properties.static(Config.get('properties'));
properties.dynamic(new Metadata(Config.get('metadata')), 'instance');
properties.dynamic(new Consul('consul', Config.get('consul')), 'consul');

// Create the Index source
sources.index(new S3('index', Config.get('index')));

// Go!
sources.initialize();

// Register endpoints
require('../lib/control/v1/core').attach(app, sources);
require('../lib/control/v1/properties').attach(app, properties);
require('../lib/control/v1/conqueso').attach(app, properties);

// Instantiate server and start it
const host = Config.get('service:hostname');
const port = Config.get('service:port');

server.listen(port, host, () => {
  Log.log('INFO', `Listening on ${host}:${port}`);
});
