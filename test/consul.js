'use strict';

require('./lib/helpers');
require('should');

const Stub = require('./lib/stub/consul');
const Consul = require('../src/lib/source/consul');

describe('Consul', function() {
  it('instantiates a Consul Source with defaults', function() {
    const consul = new Consul('test');

    // See https://github.com/silas/node-papi/blob/master/lib/client.js#L71
    consul.client._opts.host.should.eql('127.0.0.1');
    consul.client._opts.port.should.eql(8500);
    consul.client._opts.secure.should.eql(false);

    consul.properties.should.be.empty();
  });

  it('overrides defaults from constructor options', function() {
    const consul = new Consul('test', {
      host: '1.1.1.1',
      port: 1234,
      secure: true
    });

    consul.client._opts.host.should.eql('1.1.1.1');
    consul.client._opts.port.should.eql(1234);
    consul.client._opts.secure.should.eql(true);
  });

  it('sets up properties on initialize', function() {
    const consul = new Consul('test');

    consul.client = Stub;

    return consul.initialize().then(() => {
      consul.state.should.eql(Consul.RUNNING);
      consul.properties.should.eql({
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

      consul.stop();
    });
  });

  it('handles errors safely', function() {
    const consul = new Consul('test');

    consul.client = Stub;
    consul.client.health.service = (options, callback) => {
      callback(new Error('This is a test error!'), null);
    };

    return consul.initialize().then(() => {
      consul.state.should.eql(Consul.ERROR);
      consul.properties.should.be.empty();

      consul.stop();
    });
  });
});
