/* eslint-env mocha */
'use strict';

const generateConsulStub = require('./utils/consul-stub');
const request = require('supertest');

const testServerPort = 3000;

const HTTP_OK = 200;
const HTTP_METHOD_NOT_ALLOWED = 405;

const conquesoProperties = {
  instanceMetaData: {
    'meta.property.1': 'songs you have never heard of',
    'meta.property.2': 'artisanal cream cheese'
  },
  properties: {
    name: 'hipster-mode-enabled',
    value: true,
    type: 'BOOLEAN'
  }
};

const nestedProperties = {
  instanceMetaData: {
    'meta.property.1': 'songs you have never heard of',
    'meta.property.2': 'artisanal cream cheese'
  },
  properties: {
    name: 'hipster-mode-enabled',
    value: true,
    type: 'BOOLEAN',
    food: {
      name: 'tacos',
      value: true,
      type: 'BOOLEAN'
    }
  }
};

const javaProperties = 'name=hipster-mode-enabled\nvalue=true\ntype=BOOLEAN';
const nestedJavaProperties = 'name=hipster-mode-enabled\nvalue=true\ntype=BOOLEAN\nfood.name=tacos\n' +
    'food.value=true\nfood.type=BOOLEAN';

/**
 * Create a new Express server for testing
 *
 * @param {Object} propsUnderTest
 * @return {http.Server}
 */
function makeServer(propsUnderTest) {
  const app = require('express')();

  require('../lib/control/v1/conqueso').attach(app, propsUnderTest);
  return app.listen(testServerPort);
}

describe('Conqueso API v1', () => {
  let server = null;

  beforeEach(() => {
    server = makeServer(conquesoProperties);
  });

  afterEach((done) => {
    server.close(done);
  });

  it('acknowledges GET requests', (done) => {
    request(server)
      .get('/v1/conqueso/api/roles')
      .set('Accept', 'text/plain')
      .expect('Content-Type', 'text/plain; charset=utf-8')
      .expect(HTTP_OK, javaProperties, done);
  });

  it('acknowledges POST requests', (done) => {
    request(server)
      .post('/v1/conqueso/api/roles/search/properties')
      .send(conquesoProperties)
      .expect(HTTP_OK, '', done);
  });

  it('acknowledges PUT requests', (done) => {
    request(server)
      .put('/v1/conqueso/api/roles/search/properties')
      .send(conquesoProperties)
      .expect(HTTP_OK, '', done);
  });

  it('acknowledges OPTIONS requests', (done) => {
    request(server)
      .options('/v1/conqueso')
      .expect('Allow', 'GET,POST,PUT,OPTIONS')
      .expect(HTTP_OK, '', done);
  });

  it('rejects DELETE requests', (done) => {
    request(server)
      .delete('/v1/conqueso')
      .expect('Allow', 'GET,POST,PUT,OPTIONS')
      .expect(HTTP_METHOD_NOT_ALLOWED, '', done);
  });

  it('rejects TRACE requests', (done) => {
    request(server)
      .trace('/v1/conqueso')
      .expect('Allow', 'GET,POST,PUT,OPTIONS')
      .expect(HTTP_METHOD_NOT_ALLOWED, '', done);
  });

  it('rejects HEAD requests', (done) => {
    request(server)
      .head('/v1/conqueso')
      .expect('Allow', 'GET,POST,PUT,OPTIONS')
      .expect(HTTP_METHOD_NOT_ALLOWED, '', done);
  });
});

// This is split out into a separate 'describe' group because of the way express binds ports
describe('Conqueso API v1', () => {
  let server;

  before(() => {
    server = makeServer(nestedProperties);
  });
  it('emits properly flattened data', (done) => {
    request(server)
      .get('/v1/conqueso/api/roles')
      .set('Accept', 'text/plain')
      .expect('Content-Type', 'text/plain; charset=utf-8')
      .expect(HTTP_OK, nestedJavaProperties, done);
  });
  after((done) => {
    server.close(done);
  });
});

describe('Conqueso API vi1', () => {
  let consul = null;
  let server = null;

  before(() => {
    consul = generateConsulStub();
    server = makeServer(consul);
    consul.initialize();
  });


  after((done) => {
    consul.shutdown();
    server.close(done);
  });

  it('formats IP addresses for untagged Consul services', (done) => {
    consul.on('update', () => {
      request(server)
        .get('/v1/conqueso/api/roles')
        .set('Accept', 'text/plain')
        .expect('Content-Type', 'text/plain; charset=utf-8')
        .expect(HTTP_OK, 'elasticsearch.addresses=10.0.0.0,127.0.0.1', done);
    });

    consul.mock.emitChange('catalog-service', {
      elasticsearch: []
    });
    consul.mock.emitChange('elasticsearch', [{
      Service: {Address: '10.0.0.0'}
    },{
      Service: {Address: '127.0.0.1'}
    }]);
  });
});
