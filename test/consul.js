/* eslint-env mocha */
'use strict';

const Storage = require('../lib/storage');
const generateConsulStub = require('./utils/consul-stub');
const chai = require('chai');
const should = require('should');

chai.use(require('chai-as-promised'));

describe('Consul#constructor', () => {
  it('connects to a Consul agent on localhost by default', () => {
    const consul = generateConsulStub();

    should(consul.host).eql('127.0.0.1');
  });

  it('allows overwriting the Consul agent host', () => {
    const consul = generateConsulStub({host: '10.0.0.0'});

    should(consul.host).eql('10.0.0.0');
  });

  it('connects to a Consul agent on port 8500 by default', () => {
    const defaultAgentPort = 8500;
    const consul = generateConsulStub();

    should(consul.port).eql(defaultAgentPort);
  });

  it('allows overwriting the Consul agent port', () => {
    const explicitAgentPort = 8600;
    const consul = generateConsulStub({port: explicitAgentPort});

    should(consul.port).eql(explicitAgentPort);
  });

  it('connects to Consul on HTTPS by default', () => {
    const consul = generateConsulStub();

    should(consul.secure).eql(true);
  });

  it('allows enabling HTTP', () => {
    const consul = generateConsulStub({secure: false});

    should(consul.secure).eql(false);
  });
});

describe('Consul#status', () => {
  it('reports as running after startup', (done) => {
    const consul = generateConsulStub();

    consul.on('init', () => {
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

  it('reports as not okay until initialized', () => {
    const consul = generateConsulStub();

    should(consul.status().ok).eql(false);
    consul.initialize();
    should(consul.status().ok).eql(true);
  });

  it('reports as not okay after shutdown', () => {
    const consul = generateConsulStub();

    consul.initialize();
    should(consul.status().ok).eql(true);
    consul.shutdown();
    should(consul.status().ok).eql(false);
  });

  it('reports as not okay after a Consul service/list API error', (done) => {
    const consul = generateConsulStub();

    consul.on('error', () => {
      should(consul.status().ok).eql(false);
      done();
    });

    consul.initialize();
    consul.mock.emitError('catalog-service', new Error('Mock service/list error'));
  });

  it('reports as okay after the Consul service/list API updates', () => {
    const consul = generateConsulStub();

    consul.initialize();
    consul.mock.emitError('catalog-service', new Error('Mock service/list error'));
    consul.mock.emitChange('catalog-service', {consul: []});

    return Promise.resolve(consul.status().ok).should.eventually.eql(true);
  });

  it('reports as not okay after a Consul health/service API error', (done) => {
    const consul = generateConsulStub();

    consul.on('error', () => {
      should(consul.status().ok).eql(false);
      done();
    });

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitError('consul', new Error('Mock health/service error'));
  });

  it('reports as okay after the Consul health/service API updates', () => {
    const consul = generateConsulStub();

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitError('consul', new Error('Mock health/service error'));
    consul.mock.emitChange('consul', []);

    return Promise.resolve(consul.status().ok).should.eventually.eql(true);
  });

  it('reports last update time', () => {
    const start = new Date();
    const consul = generateConsulStub();

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    should(consul.status().updated).be.null();
    consul.mock.emitChange('consul', []);

    return Promise.resolve(consul.status().updated.getTime()).should.eventually.be.aboveOrEqual(start.getTime());
  });
});

describe('Consul#configure', () => {
  it('changes the Consul agent address', () => {
    const agentAddress = '10.0.0.0';
    const consul = generateConsulStub();

    should(consul.host).not.eql(agentAddress);
    consul.configure({host: agentAddress});
    should(consul.host).eql(agentAddress);
  });

  it('changes the Consul agent port', () => {
    const agentPort = 8600;
    const consul = generateConsulStub();

    should(consul.port).not.eql(agentPort);
    consul.configure({port: agentPort});
    should(consul.port).eql(agentPort);
  });

  it('changes the Consul agent security', () => {
    const agentSecurity = false;
    const consul = generateConsulStub();

    should(consul.secure).not.eql(agentSecurity);
    consul.configure({secure: agentSecurity});
    should(consul.secure).eql(agentSecurity);
  });
});

describe('Consul', () => {
  it('identifies as a "consul" source plugin', () => {
    const consul = generateConsulStub();

    should(consul.type).eql('consul');
  });

  it('has a name', () => {
    const consul = generateConsulStub();

    should(consul.name).eql('consul');
  });

  it('avoids sending multiple startup events', () => {
    const consul = generateConsulStub();
    let startupCount = 0;

    consul.on('init', () => {
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

  it('namespaces resolved properties within a "consul" group', () => {
    const consul = generateConsulStub();

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitChange('consul', []);

    return Promise.resolve(consul.properties).should.eventually.have.property('consul');
  });

  it('resolves an empty object if no addresses are found', () => {
    const consul = generateConsulStub();

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitChange('consul', []);

    return Promise.resolve(consul.properties.consul).should.eventually.eql({});
  });

  it('resolves addresses at the node level by default', () => {
    const consul = generateConsulStub();

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitChange('consul', [{
      Node: {Address: '10.0.0.0'}
    }]);

    return Promise.resolve(consul.properties.consul).should.eventually.eql({
      consul: {
        cluster: 'consul',
        addresses: ['10.0.0.0']
      }
    });
  });

  it('avoids resolving empty node addresses', () => {
    const consul = generateConsulStub();

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitChange('consul', [{
      Node: {Address: ''}
    }]);

    return Promise.resolve(consul.properties.consul).should.eventually.eql({
      consul: {
        cluster: 'consul',
        addresses: []
      }
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

    return Promise.resolve(consul.properties.consul).should.eventually.eql({
      consul: {
        cluster: 'consul',
        addresses: ['127.0.0.1']
      }
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

    return Promise.resolve(consul.properties.consul).should.eventually.eql({
      consul: {
        cluster: 'consul',
        addresses: ['10.0.0.0']
      }
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

    return Promise.resolve(consul.properties.consul).should.eventually.eql({
      consul: {
        cluster: 'consul',
        addresses: ['10.0.0.0', '127.0.0.1']
      }
    });
  });

  it('registers a watch on services when initialized', () => {
    const consul = generateConsulStub();

    consul.initialize();
    should(consul.mock.watching).eql(['catalog-service']);
  });

  it('unregisters the watch on services when shutdown', () => {
    const consul = generateConsulStub();

    consul.initialize();
    consul.shutdown();
    should(consul.mock.watching).eql([]);
  });

  it('registers health watchers when services are added', () => {
    const consul = generateConsulStub();

    consul.initialize();
    consul.mock.emitChange('catalog-service', {
      consul: ['production'],
      elasticsearch: ['production']
    });

    return Promise.resolve(consul.mock.watching).should.eventually.eql(
      ['catalog-service', 'consul', 'elasticsearch']
    );
  });

  it('unregisters health watchers when services are removed', () => {
    const consul = generateConsulStub();

    consul.initialize();
    consul.mock.emitChange('catalog-service', {
      consul: ['production'],
      elasticsearch: ['production']
    });
    consul.mock.emitChange('consul', []);

    return Promise.resolve(consul.mock.watching).should.eventually.eql(
      ['catalog-service', 'elasticsearch']
    );
  });

  it('unregisters health watchers when shutdown', (done) => {
    const consul = generateConsulStub();

    consul.on('update', () => {
      should(consul.mock.watching).eql(['catalog-service', 'consul']);
      consul.shutdown();
      should(consul.mock.watching).eql([]);
      done();
    });

    consul.initialize();
    consul.mock.emitChange('catalog-service', {
      consul: ['production'],
      elasticsearch: ['production']
    });
    consul.mock.emitChange('elasticsearch', []);
  });

  it('emits itself on update', (done) => {
    const consul = generateConsulStub();

    consul.on('update', (source) => {
      should(consul).equal(source);
      done();
    });

    consul.initialize();
    consul.mock.emitChange('catalog-service', {elasticsearch: ['production']});
    consul.mock.emitChange('elasticsearch', []);
  });

  it('can clear its properties', (done) => {
    const consul = generateConsulStub();

    consul.on('update', () => {
      consul.clear();
      should(consul.properties.consul).eql({});
      done();
    });

    consul.initialize();
    consul.mock.emitChange('catalog-service', {elasticsearch: ['production']});
    consul.mock.emitChange('elasticsearch', []);
  });
});

describe('Storage engine', () => {
  it('can merge properties from Consul plugin', () => {
    const consul = generateConsulStub();
    const storage = new Storage();

    storage.register(consul);

    consul.once('update', () => {
      storage.update();
    });

    consul.initialize();
    consul.mock.emitChange('catalog-service', {consul: []});
    consul.mock.emitChange('consul', [{
      Node: {Address: '10.0.0.0'}
    }]);

    return Promise.resolve(storage.properties.consul).should.eventually.eql({
      consul: {
        cluster: 'consul',
        addresses: ['10.0.0.0']
      }
    });
  });

  it('resolves multiple tags as separate services');

  it('avoids resolving similar tags to the same service');
});
