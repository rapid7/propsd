/* eslint-env mocha */
'use strict';

const testServerPort = 3000;

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
});
