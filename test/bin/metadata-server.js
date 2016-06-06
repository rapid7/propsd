#!/usr/bin/env node
'use strict';

const Path = require('path');
const server = require('../utils/test-metadata-server');

global.Config = require('nconf')
    .argv()
    .env()
    .file(Path.resolve(__dirname, '../data/config.json'))
    .defaults(require('../../config/defaults.json'));
global.Log = require('../../lib/logger').attach(Config.get('log:level'));

server.start();
