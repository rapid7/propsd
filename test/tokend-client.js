'use strict';

require('./lib/helpers');

const expect = require('chai').expect;
const TokendClient = require('../lib/transformers/tokend-client');

describe('TokendClient', function () {
  it('finds Tokend on 127.0.0.1:4500 by default', function () {
    const client = new TokendClient();

    expect(client._host).to.equal('127.0.0.1');
    expect(client._port).to.equal(4500);
  });

  it('allows Tokend to be found on a non-default host:port', function () {
    const client = new TokendClient({
      host: 'token.d',
      port: 2600
    });

    expect(client._host).to.equal('token.d');
    expect(client._port).to.equal(2600);
  });
});
