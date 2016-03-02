/* eslint-env mocha */
'use strict';

const EventEmitter = require('events').EventEmitter;
const path = require('path');
const chai = require('chai');
chai.use(require('chai-as-promised'));
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

  get watching() {
    return Object.keys(this.emitters).sort();
  }

  watch(options) {
    if (options.method === this.catalog.service.list) {
      return this.getOrCreateEmitter('catalog-service');
    }

    if (options.method === this.health.service) {
      let name = options.options.service;

      if (options.options.tag) {
        name += '-' + options.options.tag;
      }

      return this.getOrCreateEmitter(name);
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
      this.emitters[name].end = () => {
        delete this.emitters[name];
      };
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

  it('avoids sending multiple startup events', () => {
    const consul = generateConsulStub();
    let startupCount = 0;

    consul.on('startup', () => {
      startupCount += 1;
    });

    consul.initialize();
    consul.initialize();

    return new Promise((resolve, reject) => {
      if (startupCount !== 1) {
        reject(new Error('Too many Consul#startup events sent'));
      } else {
        resolve(startupCount);
      }
    });
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

  it('resolves an empty object if no addresses are found', () => {
    const consul = generateConsulStub();
    let updateCount = 0;

    consul.on('update', (properties) => {
      should(consul.properties).eql(properties);
      should(properties).eql({});
      updateCount += 1;
    });

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitChange('consul', []);

    return Promise.resolve(updateCount).should.eventually.eql(2);
  });

  it('resolves addresses at the node level by default', () => {
    const consul = generateConsulStub();

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitChange('consul', [{
      Node: {Address: '10.0.0.0'}
    }]);

    return Promise.resolve(consul.properties).should.eventually.eql({
      consul: {addresses: ['10.0.0.0']}
    });
  });

  it('avoids resolving empty node addresses', () => {
    const consul = generateConsulStub();

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitChange('consul', [{
      Node: {Address: ''}
    }]);

    return Promise.resolve(consul.properties).should.eventually.eql({
      consul: {addresses: []}
    });
  });

  it('resolves addresses at the service level if defined', () => {
    const consul = generateConsulStub();

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitChange('consul', [{
      Node: {Address: '10.0.0.0'},
      Service: {Address: '127.0.0.1'}
    }]);

    return Promise.resolve(consul.properties).should.eventually.eql({
      consul: {addresses: ['127.0.0.1']}
    });
  });

  it('avoids resolving empty service addresses', () => {
    const consul = generateConsulStub();

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitChange('consul', [{
      Node: {Address: '10.0.0.0'},
      Service: {Address: ''}
    }]);

    return Promise.resolve(consul.properties).should.eventually.eql({
      consul: {addresses: ['10.0.0.0']}
    });
  });

  it('resolves multiple addresses for the same service', () => {
    const consul = generateConsulStub();

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitChange('consul', [{
      Service: {Address: '127.0.0.1'}
    }, {
      Node: {Address: '10.0.0.0'}
    }]);

    return Promise.resolve(consul.properties).should.eventually.eql({
      consul: {addresses: ['10.0.0.0', '127.0.0.1']}
    });
  });

  it('resolves multiple tags as separate services', () => {
    const consul = generateConsulStub();

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: ['production', 'development']});
    consul.mock.emitChange('consul-production', [{
      Service: {Address: '127.0.0.1'}
    }]);
    consul.mock.emitChange('consul-development', [{
      Service: {Address: '10.0.0.0'}
    }]);

    return Promise.resolve(consul.properties).should.eventually.eql({
      'consul-production': {addresses: ['127.0.0.1']},
      'consul-development': {addresses: ['10.0.0.0']}
    });
  });

  it('avoids resolving similar tags to the same service', () => {
    const consul = generateConsulStub();

    consul.initialize();
    consul.mock.emitChange('catalog-service', {
      consul: ['production'],
      elasticsearch: ['production']
    });
    consul.mock.emitChange('consul-production', [{
      Service: {Address: '127.0.0.1'}
    }]);
    consul.mock.emitChange('elasticsearch-production', [{
      Service: {Address: '10.0.0.0'}
    }]);

    return Promise.resolve(consul.properties).should.eventually.eql({
      'consul-production': {addresses: ['127.0.0.1']},
      'elasticsearch-production': {addresses: ['10.0.0.0']}
    });
  });

  it('registes health watchers when services are added', () => {
    const consul = generateConsulStub();

    consul.initialize();
    should(consul.mock.watching).eql(['catalog-service']);

    consul.mock.emitChange('catalog-service', {
      consul: ['production'],
      elasticsearch: ['production']
    });

    return Promise.resolve(consul.mock.watching).should.eventually.eql(
      ['catalog-service', 'consul-production', 'elasticsearch-production']
    );
  });

  it('unregisters health watchers when services are removed', () => {
    const consul = generateConsulStub();

    consul.initialize();
    should(consul.mock.watching).eql(['catalog-service']);

    consul.mock.emitChange('catalog-service', {
      consul: ['production'],
      elasticsearch: ['production']
    });

    consul.mock.emitChange('consul-production', []);

    return Promise.resolve(consul.mock.watching).should.eventually.eql(
      ['catalog-service', 'elasticsearch-production']
    );
  });
});
