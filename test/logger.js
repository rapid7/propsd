/* eslint-env mocha */
'use strict';

require('should');
const Winston = require('winston');

function argumentNames(fun) {
  const names = fun.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/)[1]
      .replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
      .replace(/\s+/g, '').split(',');

  return names.length === 1 && !names[0] ? [] : names;
}

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
  const log = require('../lib/logger').attach(config.get('log:level'));

  it('returns a WINSTON object', () => {
    log.should.be.an.instanceOf(Winston.Logger);
  });

  it('sets the log level correctly', () => {
    log.level.should.be.exactly('info');
  });

  it('logs access requests', () => {
    const Logger = require('../lib/logger');
    const accessLog = Logger.attach(config.get('log:access:level'));
    const morgan = Logger.logRequests((message) => accessLog.log(config.get('log:access:level'), message));
    const args = argumentNames(morgan);

    morgan.should.be.a.Function();

    // All express middleware should accept 3 params, req, res, and next. This is how we test that what's returned
    // from Logger.logRequests is an instance of an express middleware. It's not a great way to test this but at
    // least we can tell that the request logger looks right.
    args.should.be.eql(['req', 'res', 'next']);
  });
});
