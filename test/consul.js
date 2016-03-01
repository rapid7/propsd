/* eslint-env mocha */
'use strict';

const EventEmitter = require('events').EventEmitter;
const path = require('path');
const should = require('should');
const winston = require('winston');
const proxyquire = require('proxyquire');

global.Config = require('../lib/config').load(path.resolve(__dirname, './data/config.json'));
global.Log = require('../lib/logger').attach(global.Config);
global.Log.remove(winston.transports.Console);


class MockConsul {
  constructor() {
    // Mock the catalog.service.list function.
    this.catalog = {
      service: {
        list: 'catalog.service.list'
      }
    };

    // Mock the health.service function.
    this.health = {
      service: 'health.service'
    };

    // Track the mocked emitters.
    this.emitters = Object.create(null);
  }

  watch(options) {
    if (options.method === this.catalog.service.list) {
      return this.getOrCreateEmitter('catalog-service');
    }
    if (options.method === this.health.service) {
      return this.getOrCreateEmitter(options.options.tag || options.options.service);
    }
    throw new Error('Unknown method: ' + options.method);
  }

  emitChange(name, data) {
    this.emitters[name].emit('change', data);
  }

  getOrCreateEmitter(name) {
    if (!this.emitters[name]) {
      this.emitters[name] = new EventEmitter();
    }
    return this.emitters[name];
  }
}

function generateConsulStub(mock, options) {
  const Consul = proxyquire('../lib/source/consul', {
    'consul': function() {
      return mock;
    }
  });
  return new Consul(options);
}

describe('Consul source plugin', () => {
  it('has a default timer interval', () => {
    const defaultTimerInterval = 60000;
    const mockConsul = new MockConsul();
    const consul = generateConsulStub(mockConsul);

    consul.interval.should.eql(defaultTimerInterval);
  });

  it('can be created with a non-default timer interval', () => {
    const nonDefaultTimerInterval = 1000;
    const mockConsul = new MockConsul();
    const consul = generateConsulStub(mockConsul, {interval: nonDefaultTimerInterval});

    consul.interval.should.eql(nonDefaultTimerInterval);
  });

  it('emits an update event when properites change', (done) => {
    const emitter = new EventEmitter();
    const mockConsul = new MockConsul();
    const consul = generateConsulStub(mockConsul);

    consul.on('update', (properties) => {
      should(properties).eql({consul: {addresses: []}});
      done();
    });

    consul.initialize();
    mockConsul.emitChange('catalog-service', {consul: []});
    mockConsul.emitChange('consul', {});
  });
});
