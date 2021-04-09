'use strict';

const proxyquire = require('proxyquire');

module.exports = function generateS3Proxy(stubs) {
  return proxyquire('../../src/lib/source/s3', {
    'aws-sdk': {
      S3: function constructor() {
        return stubs;
      }
    }
  });
};
