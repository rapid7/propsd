'use strict';

const EventEmitter = require('events').EventEmitter;
const proxyquire = require('proxyquire');

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
        name += `-${options.options.tag}`;
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

function generateConsulStub(options) {
  const mock = new MockConsul();
  const Consul = proxyquire('../lib/source/consul', {
    consul() {
      return mock;
    }
  });
  const consul = new Consul(options);

  consul.mock = mock;
  return consul;
}

module.exports = generateConsulStub;
