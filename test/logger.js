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
    'log:level': 'info',
    'log:access:level': 'verbose'
  });
  const log = require('../dist/lib/logger').attach(config.get('log:level'));

  it('returns a WINSTON object', () => {
    log.should.be.an.instanceOf(Winston.Logger);
  });

  it('sets the log level correctly', () => {
    log.level.should.be.exactly('INFO');
  });

  describe('File logging', () => {
    const fileLog = require('../dist/lib/logger').attach('INFO', 'tmp.log');

    fileLog.remove(Winston.transports.Console);

    it('writes to the correct file', (done) => {
      fileLog.on('logging', (transport, level, msg) => {
        transport.name.should.equal('file');
        transport.filename.should.equal('tmp.log');
        msg.should.equal('Test logging message');
        done();
      });

      fileLog.log('INFO', 'Test logging message');
    });

    it('optionally logs to a file', () => {
      const logger = require('../dist/lib/logger').attach('info');

      Object.keys(logger.transports).should.eql(['console']);
    });

    it('displays a deprecation warning when instantiating a file logger', (done) => {
      process.on('deprecation', (err) => {
        err.name.should.equal('DeprecationError');
        err.namespace.should.equal('propsd');
        err.message.should.equal('The file transport has been deprecated and will be removed in a later version');
        done();
      });

      require('../dist/lib/logger').attach('info', 'tmp.log');
    });
  });
});
