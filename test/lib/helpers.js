'use strict';

global.Log = new (require('winston').Logger);
global.Config = require('nconf');

Config.defaults({
  // The S3 Source module uses some Config parameters as defaults
  index: {
    path: 'index.json',
    interval: 30000,
    region: 'us-east-1',
    bucket: 'fake-default-bucket-for-testing'
  }
});
