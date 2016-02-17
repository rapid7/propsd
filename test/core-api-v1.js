/* eslint-env mocha */
'use strict';

const request = require('supertest');

const testServerPort = 3000;
const HTTP_OK = 200;
const HTTP_METHOD_NOT_ALLOWED = 405;

const sourceStatus = () => {
  return true;
};

const storage = {
  index: {
    status: sourceStatus
  },
  sources: [{
    name: '',
    type: '',
    status: sourceStatus
  }, {
    name: '',
    type: '',
    status: sourceStatus
  }],
  config: {
    get: () => {
      return true;
    }
  }
};

const endpoints = {
  health: '/v1/health',
  status: '/v1/status'
};

/**
 * Create a new Express server for testing
 *
 * @return {http.Server}
 */
const makeServer = () => {
  const app = require('express')();

  require('../lib/control/v1/core').attach(app, storage);
  return app.listen(testServerPort);
};

describe('Core API v1', () => {
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

    /* eslint-disable no-loop-func */
    it(`acknowledges GET requests to the ${endpoint} endpoint`, (done) => {
      request(server)
          .get(endpoints[endpoint])
          .set('Accept', 'application/json')
          .expect('Content-Type', 'application/json; charset=utf-8')
          .expect(HTTP_OK)
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

    /* eslint-enable no-loop-func */
  }
});
