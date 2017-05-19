'use strict';

require('./lib/helpers');

const Stub = require('./lib/stub/consul');
const Consul = require('../lib/source/consul');

const expect = require('chai').expect;

describe('Consul', function() {
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

  it('sets up properties on initialize', function() {
    const consul = new Consul('test');

    consul.client = Stub;

    return consul.initialize().then(() => {
      expect(consul.state).to.equal(Consul.RUNNING);
      expect(consul.properties).to.eql({
        consul: {
          consul: {
            cluster: 'consul',
            addresses: ['10.0.0.1', '10.0.0.2', '10.0.0.3']
          },
          redis: {
            cluster: 'redis',
            addresses: ['10.0.0.1']
          },
          postgresql: {
            cluster: 'postgresql',
            addresses: ['10.0.0.2']
          }
        }
      });
    });
  });

  it('handles errors safely', function() {
    const consul = new Consul('test');

    consul.client = Stub;
    consul.client.health.service = (options, callback) => {
      callback(new Error('This is a test error!'), null);
    };

    return consul.initialize().then(() => {
      expect(consul.state).to.equal(Consul.ERROR);
      expect(consul.properties).to.eql({});
    });
  });
});
