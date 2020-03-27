'use strict';

require('./lib/helpers');

const ConsulStub = require('./lib/stub/consul');
const Consul = require('../src/lib/source/consul');

const expect = require('chai').expect;
const request = require('supertest');

const testServerPort = 3000;
const fixedDate = new Date();
const fixedRegex = /ab+c/i;

const HTTP_OK = 200;
const HTTP_METHOD_NOT_ALLOWED = 405;

const conquesoProperties = {
  instanceMetaData: {
    'meta.property.1': 'songs you have never heard of',
    'meta.property.2': 'artisanal cream cheese'
  },
  properties: Promise.resolve({
    date: fixedDate,
    regex: fixedRegex,
    name: 'hipster-mode-enabled',
    value: true,
    type: 'BOOLEAN'
  }),
  on() {}
};

const nestedProperties = {
  instanceMetaData: {
    'meta.property.1': 'songs you have never heard of',
    'meta.property.2': 'artisanal cream cheese'
  },
  properties: Promise.resolve({
    name: 'hipster-mode-enabled',
    value: true,
    type: 'BOOLEAN',
    food: {
      name: 'tacos',
      value: true,
      type: 'BOOLEAN'
    }
  }),
  on() {}
};

const javaProperties = [
  `date=${fixedDate}`,
  'regex=/ab+c/i',
  'name=hipster-mode-enabled',
  'value=true',
  'type=BOOLEAN'
].join('\n');
const nestedJavaProperties = [
  'name=hipster-mode-enabled',
  'value=true',
  'type=BOOLEAN',
  'food.name=tacos',
  'food.value=true',
  'food.type=BOOLEAN'
].join('\n');

/**
 * Create a new Express server for testing
 *
 * @param {Object} propsUnderTest
 * @return {http.Server}
 */
function makeServer(propsUnderTest) {
  const app = require('express')();

  require('../src/lib/control/v1/conqueso').attach(app, propsUnderTest);

  return app.listen(testServerPort);
}

describe('Conqueso API v1', function() {
  let server = null;

  beforeEach(function() {
    server = makeServer(conquesoProperties);
  });

  afterEach(function(done) {
    server.close(done);
  });

  it('acknowledges GET requests', function(done) {
    request(server)
      .get('/v1/conqueso/api/roles')
      .set('Accept', 'text/plain')
      .expect('Content-Type', 'text/plain; charset=utf-8')
      .expect(HTTP_OK, javaProperties, done);
  });

  it('acknowledges POST requests', function(done) {
    request(server)
      .post('/v1/conqueso/api/roles/search/properties')
      .send(conquesoProperties)
      .expect(HTTP_OK, '', done);
  });

  it('acknowledges PUT requests', function(done) {
    request(server)
      .put('/v1/conqueso/api/roles/search/properties')
      .send(conquesoProperties)
      .expect(HTTP_OK, '', done);
  });

  it('acknowledges OPTIONS requests', function(done) {
    request(server)
      .options('/v1/conqueso')
      .expect('Allow', 'GET,POST,PUT,OPTIONS')
      .expect(HTTP_OK, '', done);
  });

  it('rejects DELETE requests', function(done) {
    request(server)
      .delete('/v1/conqueso')
      .expect('Allow', 'GET,POST,PUT,OPTIONS')
      .expect(HTTP_METHOD_NOT_ALLOWED, '', done);
  });

  it('rejects TRACE requests', function(done) {
    request(server)
      .trace('/v1/conqueso')
      .expect('Allow', 'GET,POST,PUT,OPTIONS')
      .expect(HTTP_METHOD_NOT_ALLOWED, '', done);
  });

  it('rejects HEAD requests', function(done) {
    request(server)
      .head('/v1/conqueso')
      .expect('Allow', 'GET,POST,PUT,OPTIONS')
      .expect(HTTP_METHOD_NOT_ALLOWED, '', done);
  });
});

// This is split out into a separate 'describe' group because of the way express binds ports
describe('Conqueso API v1', function() {
  let server;

  before(function() {
    server = makeServer(nestedProperties);
  });
  it('emits properly flattened data', function(done) {
    request(server)
      .get('/v1/conqueso/api/roles')
      .set('Accept', 'text/plain')
      .expect('Content-Type', 'text/plain; charset=utf-8')
      .expect(HTTP_OK, nestedJavaProperties, done);
  });

  it('retrieves a specific property if it exists', function(done) {
    request(server)
      .get('/v1/conqueso/api/roles/global/properties/food.name')
      .set('Accept', 'text/plain')
      .expect('Content-Type', 'text/plain; charset=utf-8')
      .expect(HTTP_OK, 'tacos', done);
  });

  it('returns no data if a specific property does not exist', function(done) {
    request(server)
      .get('/v1/conqueso/api/roles/global/properties/food.gluten')
      .set('Accept', 'text/plain')
      .expect('Content-Type', 'text/plain; charset=utf-8')
      .expect(HTTP_OK, '', done);
  });

  after(function(done) {
    server.close(done);
  });
});

describe('Conqueso API v1', function() {
  let consul = null,
      server = null;

  beforeEach(function(done) {
    consul = new Consul('consul');
    consul.client = ConsulStub;

    consul.initialize().then(function() {
      server = makeServer({
        properties: Promise.resolve(consul.properties)
      });

      done();
    });
  });

  afterEach(function(done) {
    consul.shutdown();
    server.close(done);
  });

  it('formats IP addresses for Consul services', function(done) {
    const expected = [
      'conqueso.postgresql.ips=10.0.0.2',
      'conqueso.redis.ips=10.0.0.1',
      'conqueso.consul.ips=10.0.0.1,10.0.0.2,10.0.0.3'
    ];

    request(server)
      .get('/v1/conqueso/api/roles')
      .set('Accept', 'text/plain')
      .expect('Content-Type', 'text/plain; charset=utf-8')
      .expect((res) => {
        expect(res.text.split(/\n/g)).to.members(expected);
      })
      .expect(HTTP_OK, done);
  });

  it('removes reserved "instance" keyword from properties', function(done) {
    server.close();

    server = makeServer({
      properties: Promise.resolve({
        instance: {
          food: 'tacos'
        },
        gluten: 'free'
      }),
      on() {}
    });

    request(server)
      .get('/v1/conqueso/api/roles')
      .set('Accept', 'text/plain')
      .expect('Content-Type', 'text/plain; charset=utf-8')
      .expect(HTTP_OK, 'gluten=free', done);
  });
});
