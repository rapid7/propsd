/* eslint-env mocha */
'use strict';

const request = require('supertest');

const testServerPort = 3000;

const HTTP_OK = 200;
const HTTP_METHOD_NOT_ALLOWED = 405;

const conquesoProperties = {
  instanceMetaData: {
    'meta.property.1': 'songs you have never heard of',
    'meta.property.2': 'artisanal cream cheese'
  },
  properties: [{
    name: 'hipster-mode-enabled',
    value: true,
    type: 'BOOLEAN',
    description: 'Are you wearing skinny jeans?'
  }]
};

/**
 * Create a new Express server for testing
 *
 * @return {http.Server}
 */
function makeServer() {
  const app = require('express')();

  require('../lib/control/v1/conqueso').attach(app);
  return app.listen(testServerPort);
}

describe('Conqueso API v1', () => {
  let server = null;

  beforeEach(() => {
    server = makeServer();
  });

  afterEach((done) => {
    server.close(done);
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

  it('rejects DELETE requests', (done) => {
    request(server)
      .delete('/v1/conqueso')
      .expect('Allow', 'POST,PUT')
      .expect(HTTP_METHOD_NOT_ALLOWED, '', done);
  });
});
