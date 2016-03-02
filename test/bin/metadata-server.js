#!/usr/bin/env node
'use strict';

const Path = require('path');
const server = require('../utils/test-metadata-server');

global.Config = require('../../lib/config').load(Path.resolve(__dirname, '../data/config.json'));
global.Log = require('../../lib/logger').attach(global.Config);

server.start();
