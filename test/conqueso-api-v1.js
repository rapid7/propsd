/* eslint-env mocha */
'use strict';

const request = require('supertest');

const testServerPort = 3000;
const HTTP_OK = 200;

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
    const properties = {
      "instanceMetaData": {
        "meta.property.1": "songs you've never heard of",
        "meta.property.2": "artisanal cream cheese"
      },
      "properties": [{
        "name": "hipster-mode-enabled",
        "value": "true",
        "type": "BOOLEAN",
        "description": "Are you wearing skinny jeans?"
      }]
    }

    request(server)
      .post('/v1/conqueso/api/roles/search/properties')
      .send(properties)
      .expect(HTTP_OK, '', done);
  });
});
