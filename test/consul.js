'use strict';

/* eslint-env mocha */
/* global Config, Log */
/* eslint-disable max-nested-callbacks, no-unused-expressions, rapid7/static-magic-numbers */

require('./lib/helpers');

const Stub = require('./lib/stub/consul');
const Consul = require('../lib/source/consul');

const Net = require('net');
const expect = require('chai').expect;

describe('Consul', function _() {
  it('instantiates a Consul Source with defaults', () => {
    const consul = new Consul('test');

    // See https://github.com/silas/node-papi/blob/master/lib/client.js#L71
    expect(consul.client._opts.host).to.equal('127.0.0.1');
    expect(consul.client._opts.port).to.equal(8500);
    expect(consul.client._opts.secure).to.equal(false);

    expect(consul.properties).to.be.empty;
  });

  it('overrides defaults from constructor options', () => {
    const consul = new Consul('test', {
      host: '1.1.1.1',
      port: 1234,
      secure: true
    });

    expect(consul.client._opts.host).to.equal('1.1.1.1');
    expect(consul.client._opts.port).to.equal(1234);
    expect(consul.client._opts.secure).to.equal(true);
  });

  const consul = new Consul('test');

  consul.client = Stub;

  it('creates a watcher and initializes on a `change` event', function __(done) {
    consul.initialize()
      .then(() => {
        expect(consul.state).to.equal(Consul.RUNNING);
        expect(consul.properties).to.include.keys('nodes', 'services');

        done();
      })
      .catch(done);

    // Trigger `initialized`
    expect(consul.watcher).to.be.instanceOf(Stub.Watcher);
    consul.watcher.change();
  });

  it('fetches the current node-catalog on a change event', function __() {
    expect(consul.parser.nodes).to.be.an('object');

    // Test that parser.nodes is a hash of ID => IP address
    Object.keys(consul.parser.nodes).forEach((id) => {
      expect(consul.parser.nodes[id]).to.be.a('string');
      expect(Net.isIPv4(consul.parser.nodes[id])).to.equal(true);
    });
  });

  it('correlates checks to nodes and correctly sets passing states', function __() {
    expect(consul.properties.nodes).to.be.an('object');

    // Expect nodes to reflect the status of their checks
    Object.keys(consul.properties.nodes).forEach((id) => {
      const node = consul.properties.nodes[id];

      const nodeServices = {};
      const nodeState = node.checks.reduce((state, check) => {
        // Roll up service check statuses
        if (check.service) {
          if (!nodeServices.hasOwnProperty(check.service)) { nodeServices[check.service] = true; }
          nodeServices[check.service] = check.passing && nodeServices[check.service];

          return state;
        }

        return check.passing && state;
      }, true);

      expect(node.passing).to.equal(nodeState);

      Object.keys(node.services).forEach((service) => {
        expect(node.services[service]).to.equal(nodeServices[service]);
      });
    });
  });

  it('only reports passing instances of services', function __() {
    Object.keys(consul.properties.services).forEach((id) => {
      const service = consul.properties.services[id];

      Object.keys(service).forEach((node) => {
        expect(consul.properties.nodes[node].passing).to.equal(true);
        expect(consul.properties.nodes[node].services[id]).to.equal(true);
      });
    });
  });

  it('handles errors safely', function ___(done) {
    consul.once('error', (err) => {
      expect(err).to.be.instanceOf(Error);
      expect(consul.state).to.equal(Consul.ERROR);

      // Doesn't drop the last-known set of services
      expect(consul.properties.services).to.not.be.empty;

      done();
    });

    consul.watcher.error();
  });

  it('returns to a healthy state on a change event', function __(done) {
    expect(consul.state).to.equal(Consul.ERROR);

    consul.once('update', () => {
      expect(consul.state).to.equal(Consul.RUNNING);
      done();
    });

    consul.watcher.change();
  });
});
