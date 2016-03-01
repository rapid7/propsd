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

  emitError(name, error) {
    this.emitters[name].emit('error', error);
  }

  getOrCreateEmitter(name) {
    if (!this.emitters[name]) {
      this.emitters[name] = new EventEmitter();
      this.emitters[name].end = () => {};
    }
    return this.emitters[name];
  }
}

function generateConsulStub() {
  const mock = new MockConsul();
  const Consul = proxyquire('../lib/source/consul', {
    consul() {
      return mock;
    }
  });
  const consul = new Consul();

  consul.mock = mock;
  return consul;
}

describe('Consul source plugin', () => {
  it('has a type', () => {
    const consul = generateConsulStub();

    should(consul.type).eql('consul');
  });

  it('has a name', () => {
    const consul = generateConsulStub();

    should(consul.name).eql('consul');
  });

  it('reports as running after startup', (done) => {
    const consul = generateConsulStub();

    consul.on('startup', () => {
      should(consul.status().running).eql(true);
      done();
    });

    should(consul.status().running).eql(false);
    consul.initialize();
  });

  it('reports as not running after shutdown', (done) => {
    const consul = generateConsulStub();

    consul.on('shutdown', () => {
      should(consul.status().running).eql(false);
      done();
    });

    consul.initialize();
    should(consul.status().running).eql(true);
    consul.shutdown();
  });

  it('bubbles errors from the Consul service/list API', (done) => {
    const consul = generateConsulStub();

    consul.on('error', (error) => {
      should(error.message).eql('Mock service/list error');
      done();
    });

    consul.initialize();
    consul.mock.emitError('catalog-service', new Error('Mock service/list error'));
  });

  it('bubbles errors from the Consul health/service API', (done) => {
    const consul = generateConsulStub();

    consul.on('error', (error) => {
      should(error.message).eql('Mock health/service error');
      done();
    });

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitError('consul', new Error('Mock health/service error'));
  });

  it('resolves empty an empty address list if no addresses are found', (done) => {
    const consul = generateConsulStub();

    consul.on('update', (properties) => {
      should(properties).eql({consul: {addresses: []}});
      done();
    });

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitChange('consul', []);
  });

  it('resolves addresses at the node level by default', (done) => {
    const consul = generateConsulStub();

    consul.on('update', (properties) => {
      should(properties).eql({consul: {addresses: ['10.0.0.0']}});
      done();
    });

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitChange('consul', [{
      Node: {Address: '10.0.0.0'}
    }]);
  });

  it('resolves addresses at the service level if defined', (done) => {
    const consul = generateConsulStub();

    consul.on('update', (properties) => {
      should(properties).eql({consul: {addresses: ['127.0.0.1']}});
      done();
    });

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitChange('consul', [{
      Node: {Address: '10.0.0.0'},
      Service: {Address: '127.0.0.1'}
    }]);
  });

  it('resolves multiple addresses for the same service', (done) => {
    const consul = generateConsulStub();

    consul.on('update', (properties) => {
      should(properties).eql({consul: {addresses: ['10.0.0.0', '127.0.0.1']}});
      done();
    });

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitChange('consul', [{
      Service: {Address: '127.0.0.1'}
    }, {
      Node: {Address: '10.0.0.0'}
    }]);
  });

  it('resolves multiple tags as separate services', (done) => {
    const consul = generateConsulStub();
    let updateCount = 0;

    consul.on('update', (properties) => {
      updateCount += 1;
      if (updateCount === 2) {
        should(properties).eql({
          production: {addresses: ['127.0.0.1']},
          development: {addresses: ['10.0.0.0']}
        });
        done();
      }
    });

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: ['production', 'development']});
    consul.mock.emitChange('production', [{
      Service: {Address: '127.0.0.1'}
    }]);
    consul.mock.emitChange('development', [{
      Service: {Address: '10.0.0.0'}
    }]);
  });

  it('avoids resolving similar tags to the same service', (done) => {
    const consul = generateConsulStub();
    let updateCount = 0;

    consul.on('update', (properties) => {
      updateCount += 1;
      if (updateCount === 2) {
        should(properties).eql({
          'consul:production': {addresses: ['127.0.0.1']},
          'elasticsearch:production': {addresses: ['10.0.0.0']}
        });
        done();
      }
    });

    consul.initialize();
    consul.mock.emitChange('catalog-service', {
      consul: ['production'],
      elasticsearch: ['production']
    });
    consul.mock.emitChange('consul:production', [{
      Service: {Address: '127.0.0.1'}
    }]);
    consul.mock.emitChange('elasticsearch:production', [{
      Service: {Address: '10.0.0.0'}
    }]);
  });
});
