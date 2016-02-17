/* eslint-env mocha */
'use strict';
const Winston = require('winston');

describe('logging', () => {
  it('returns a WINSTON object', () => {
    const config = require('../lib/config');
    const log = require('../lib/logger').attach(config);

    log.should.be.an.instanceOf(Winston.Logger);
  });
});
