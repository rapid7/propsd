/* eslint-env mocha */
'use strict';

const path = require('path');
const winston = require('winston');
const Consul = require('../lib/source/consul');

global.Config = require('../lib/config').load(path.resolve(__dirname, './data/config.json'));
global.Log = require('../lib/logger').attach(global.Config);
global.Log.remove(winston.transports.Console);

require('should');

describe('Consul source plugin', () => {
  it('has a type', () => {
    Consul.type.should.eql('consul');
  });

  it('has a default timer interval', () => {
    const defaultTimerInterval = 60000;
    const consul = new Consul();

    consul.interval.should.eql(defaultTimerInterval);
  });

  it('can be created with a non-default timer interval', () => {
    const nonDefaultTimerInterval = 1000;
    const consul = new Consul({interval: nonDefaultTimerInterval});

    consul.interval.should.eql(nonDefaultTimerInterval);
  });

  it('', (done) => {
    const consul = new Consul();

    consul.on('update', () => {
      done();
    });

    consul.initialize();
  });
});
