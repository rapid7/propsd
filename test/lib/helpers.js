'use strict';

// Build a stubby logger for things
global.Log = new (require('winston').Logger)();
global.Config = require('nconf');

Config.defaults({

});
