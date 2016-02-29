/* eslint-env mocha */
'use strict';

require('should');
const Consul = require('../lib/source/consul');

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
});
