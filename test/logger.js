/* eslint-env mocha */
'use strict';

require('should');
const fs = require('fs');
const Winston = require('winston');

class ConfigLike {
  constructor() {
    this.data = {
      'log:level': 'info',
      'log:filename': 'tmp.log'
    };
  }

  get(str) {
    return this.data[str];
  }
}

describe('Logging', () => {
  const config = new ConfigLike();
  const log = require('../lib/logger').attach(config);
  const configFile = config.get('log:filename');

  it('returns a WINSTON object', () => {
    log.should.be.an.instanceOf(Winston.Logger);
  });

  it('sets the log level correctly', () => {
    log.level.should.be.exactly('info');
  });

  before((done) => {
    log.log(config.get('log:level'), 'Test logging message');
    done();
  });

  it('writes to the correct file', (done) => {
    fs.readFileSync(configFile, 'utf8').should.not.be.Error; // eslint-disable-line no-unused-expressions
    fs.unlinkSync(configFile);
    done();
  });
});
