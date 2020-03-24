'use strict';

const request = require('supertest');
const Properties = require('../src/lib/properties');
const Sources = require('../src/lib/sources');
const S3 = require('../src/lib/source/s3');

require('./lib/helpers');
require('should');

const testServerPort = 3000;
const HTTP_OK = 200;
const HTTP_METHOD_NOT_ALLOWED = 405;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const HTTP_SERVICE_UNAVAILABLE = 503;

const endpoints = {
  health: '/v1/health',
  status: '/v1/status'
};

const expectedInitialStatusResponse = {
  status: HTTP_SERVICE_UNAVAILABLE,
  index: {
    ok: true,
    updated: null,
    interval: 60000,
    running: false,
    etag: null,
    state: 'CREATED',
    resource: 's3://test-bucket/index.json',
    name: 'index.json',
    type: 's3'
  },
  indices: [{
    ok: true,
    updated: null,
    interval: 60000,
    running: false,
    etag: null,
    state: 'CREATED',
    resource: 's3://test-bucket/index.json',
    name: 'index.json',
    type: 's3'
  }],
  sources: [{
    name: 'foo-bar-baz.json',
    type: 's3',
    status: 'okay',
    updated: null,
    etag: null,
    state: 'CREATED',
    resource: 's3://test-bucket/foo-bar-baz.json',
    ok: true,
    interval: 60000
  }, {
    name: 'foo-quiz-buzz.json',
    type: 's3',
    status: 'okay',
    updated: null,
    etag: null,
    state: 'CREATED',
    resource: 's3://test-bucket/foo-quiz-buzz.json',
    ok: true,
    interval: 60000
  }]
};

const expectedRunningStatusResponse = {
  status: HTTP_OK,
  index: {
    ok: true,
    updated: null,
    interval: 60000,
    running: true,
    etag: null,
    state: 'RUNNING',
    resource: 's3://test-bucket/index.json',
    name: 'index.json',
    type: 's3'
  },
  indices: [{
    ok: true,
    updated: null,
    interval: 60000,
    running: true,
    etag: null,
    state: 'RUNNING',
    resource: 's3://test-bucket/index.json',
    name: 'index.json',
    type: 's3'
  }],
  sources: [{
    name: 'foo-bar-baz.json',
    type: 's3',
    status: 'okay',
    updated: null,
    etag: null,
    state: 'RUNNING',
    resource: 's3://test-bucket/foo-bar-baz.json',
    ok: true,
    interval: 60000
  }, {
    name: 'foo-quiz-buzz.json',
    type: 's3',
    status: 'okay',
    updated: null,
    etag: null,
    state: 'RUNNING',
    resource: 's3://test-bucket/foo-quiz-buzz.json',
    ok: true,
    interval: 60000
  }]
};

const expectedIndexErrorStatusResponse = {
  status: HTTP_INTERNAL_SERVER_ERROR,
  index: {
    ok: false,
    updated: null,
    interval: 60000,
    running: true,
    etag: null,
    state: 'ERROR',
    resource: 's3://test-bucket/index.json',
    name: 'index.json',
    type: 's3'
  },
  indices: [{
    ok: false,
    updated: null,
    interval: 60000,
    running: true,
    etag: null,
    state: 'ERROR',
    resource: 's3://test-bucket/index.json',
    name: 'index.json',
    type: 's3'
  }],
  sources: [{
    name: 'foo-bar-baz.json',
    type: 's3',
    status: 'okay',
    updated: null,
    etag: null,
    state: 'RUNNING',
    resource: 's3://test-bucket/foo-bar-baz.json',
    ok: true,
    interval: 60000
  }, {
    name: 'foo-quiz-buzz.json',
    type: 's3',
    status: 'okay',
    updated: null,
    etag: null,
    state: 'RUNNING',
    resource: 's3://test-bucket/foo-quiz-buzz.json',
    ok: true,
    interval: 60000
  }]
};

const properties = new Properties();

properties.addDynamicLayer(new S3('foo-bar-baz.json', {
  bucket: 'test-bucket',
  path: 'foo-bar-baz.json'
}), 'test');

properties.addDynamicLayer(new S3('foo-quiz-buzz.json', {
  bucket: 'test-bucket',
  path: 'foo-quiz-buzz.json'
}), 'test');

const sources = new Sources(properties);

sources.addIndex(new S3('index.json', {
  bucket: 'test-bucket',
  path: 'index.json'
}));

/**
 * Create a new Express server for testing
 *
 * @return {http.Server}
 */
const makeServer = () => {
  const app = require('express')();

  require('../src/lib/control/v1/core').attach(app, sources);

  return app.listen(testServerPort);
};

describe('Core API v1', function() {
  let server = null;

  beforeEach(() => {
    server = makeServer();
  });

  afterEach((done) => {
    server.close(done);
  });

  for (const endpoint in endpoints) {
    if (!endpoints.hasOwnProperty(endpoint)) {
      continue;
    }

    it(`acknowledges GET requests to the ${endpoint} endpoint`, (done) => {
      request(server)
        .get(endpoints[endpoint])
        .set('Accept', 'application/json')
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(HTTP_SERVICE_UNAVAILABLE)
        .end(done);
    });

    it(`rejects all other request types to the ${endpoint} endpoint`, (done) => {
      request(server)
        .delete(endpoints[endpoint])
        .expect('Allow', 'GET')
        .expect(HTTP_METHOD_NOT_ALLOWED);

      request(server)
        .put(endpoints[endpoint])
        .expect('Allow', 'GET')
        .expect(HTTP_METHOD_NOT_ALLOWED);

      request(server)
        .post(endpoints[endpoint])
        .expect('Allow', 'GET')
        .expect(HTTP_METHOD_NOT_ALLOWED)
        .end(done);
    });
  }

  describe('When sources are uninitialized', function() {
    it('responds correctly to a request to the /status endpoint', (done) => {
      request(server)
        .get(endpoints.status)
        .set('Accept', 'application/json')
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(HTTP_SERVICE_UNAVAILABLE)
        .end((err, res) => {
          res.body.should.have.properties(expectedInitialStatusResponse);
          res.body.should.have.property('uptime');
          res.body.should.have.property('version');
          done();
        });
    });

    it('responds correctly to a request to the /health endpoint', (done) => {
      request(server)
        .get(endpoints.health)
        .set('Accept', 'application/json')
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(HTTP_SERVICE_UNAVAILABLE)
        .end((err, res) => {
          res.body.should.have.properties({status: HTTP_SERVICE_UNAVAILABLE, plugins: {s3: expectedInitialStatusResponse.sources.length}});
          res.body.should.have.property('uptime');
          res.body.should.have.property('version');
          done();
        });
    });

    it('returns a 500 if any source plugins fail');

    it('returns a 429 if any source plugins have a warning');
  });

  describe('When sources are running', function() {
    before(() => {
      sources.properties.sources.forEach((source) => {
        source.state = 'RUNNING'
      });

      sources.indices.forEach((index) => {
        index.state = 'RUNNING'
      });
    });

    it('responds correctly to a request to the /status endpoint', (done) => {
      request(server)
        .get(endpoints.status)
        .set('Accept', 'application/json')
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(HTTP_OK)
        .end((err, res) => {
          res.body.should.have.properties(expectedRunningStatusResponse);
          res.body.should.have.property('uptime');
          res.body.should.have.property('version');
          done();
        });
    });

    it('responds correctly to a request to the /health endpoint', (done) => {
      request(server)
        .get(endpoints.health)
        .set('Accept', 'application/json')
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(HTTP_OK)
        .end((err, res) => {
          res.body.should.have.properties({status: HTTP_OK, plugins: {s3: expectedRunningStatusResponse.sources.length}});
          res.body.should.have.property('uptime');
          res.body.should.have.property('version');
          done();
        });
    });
  });

  describe('When the Index is in an error state', (done) => {
    before(() => {
      sources.properties.sources.forEach((source) => {
        source.state = 'RUNNING'
      });

      sources.indices.forEach((index) => {
        index.state = 'ERROR'
      });
    });

    it('responds correctly to a request to the /status endpoint', (done) => {
      request(server)
        .get(endpoints.status)
        .set('Accept', 'application/json')
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(HTTP_INTERNAL_SERVER_ERROR)
        .end((err, res) => {
          res.body.should.have.properties(expectedIndexErrorStatusResponse);
          res.body.should.have.property('uptime');
          res.body.should.have.property('version');
          done();
        });
    });

    it('responds correctly to a request to the /health endpoint', (done) => {
      request(server)
        .get(endpoints.health)
        .set('Accept', 'application/json')
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(HTTP_INTERNAL_SERVER_ERROR)
        .end((err, res) => {
          res.body.should.have.properties({status: 500, plugins: {s3: expectedIndexErrorStatusResponse.sources.length}});
          res.body.should.have.property('uptime');
          res.body.should.have.property('version');
          done();
        });
    });
  });
});
