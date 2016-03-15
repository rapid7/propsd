/* eslint-env mocha */
'use strict';

require('should');
const Winston = require('winston');

class ConfigLike {
  constructor(data) {
    this.data = data;
  }

  get(str) {
    return this.data[str];
  }
}

describe('Logging', () => {
  const config = new ConfigLike({
    'log:level': 'info'
  });
  const log = require('../lib/logger').attach(config.get('log:level'));

  it('returns a WINSTON object', () => {
    log.should.be.an.instanceOf(Winston.Logger);
  });

  it('sets the log level correctly', () => {
    log.level.should.be.exactly('info');
  });
});
