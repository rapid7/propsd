'use strict';

const EventEmitter = require('events').EventEmitter;

const checks = require('../../data/consul-checks.json');
const nodes = require('../../data/consul-nodes.json');
const services = require('../../data/consul-catalog-services.json');
const health = require('../../data/consul-health-service.json');

class Watcher extends EventEmitter {
  constructor(data) {
    super();
    this.data = data;
  }

  change() {
    this.emit('change', this.data);
  }

  error() {
    this.emit('error', new Error('This is a test error!'));
  }

  end() {}
}
exports.Watcher = Watcher;

// Data mappings. These get passed as the `method` parameter of `watch`
exports.health = {
  service: function service(options, callback) {
    const name = options.service;
    let results = health[name];

    if (options.passing) {
      results = results.filter((node) => !!node.Checks.every((check) => check.Status === 'passing'));
    }

    setTimeout(function _() {
      callback(null, results);
    }, 150);
  },
  state: checks
};

// Method stubs
exports.watch = function watch(options) {
  if (!options.method) {
    throw ReferenceError('No method provided for watcher!');
  }

  return new Watcher(options.method);
};

exports.catalog = {
  service: {
    list: function list(options, callback) {
      setTimeout(function _() {
        callback(null, services);
      }, 150);
    }
  },
  node: {
    list: function list(callback) {
      // Simulate a little bit of network-service latency
      setTimeout(function _() {
        callback(null, nodes);
      }, 150);
    }
  }
};

// Export some useful datasets to test against
exports.data = {
  checks: {
    passing: checks.filter((check) => check.Status === 'passing'),
    warning: checks.filter((check) => check.Status === 'warning'),
    critical: checks.filter((check) => check.Status === 'critical')
  }
};
