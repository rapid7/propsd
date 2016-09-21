'use strict';

require('./lib/helpers');

const expect = require('chai').expect;
const nock = require('nock');
const TokendClient = require('../lib/transformers/tokend-client');

describe('TokendClient', function () {
  beforeEach(function () {
    nock.cleanAll();
  });

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

  it('only calls Tokend once for each secret', function (done) {
    // Nock clears a response after it's requested.
    // Processing the same secret more than once will fail when tokend.done() is called.
    const tokend = nock('http://127.0.0.1:4500')
      .get('/v1/secret/default/kali/root/password')
      .reply(200, {
        plaintext: 'toor'
      });

    const client = new TokendClient();

    const secret1 = client.get('/v1/secret/default/kali/root/password');
    const secret2 = client.get('/v1/secret/default/kali/root/password');

    Promise.all([secret1, secret2]).then((secrets) => {
      secrets.forEach((secret) => {
        expect(secret).to.eql({
          plaintext: 'toor'
        });
      });

      tokend.done();
      done();
    })
    .catch(done);
  });

  it('emits "update" events when secrets in Tokend change', function (done) {
    // Nock clears a response after it's requested.
    const tokend = nock('http://127.0.0.1:4500')

      // First request comes from TokendClient.get call
      .get('/v1/secret/default/kali/root/password')
      .reply(200, {
        plaintext: 'toor'
      })

      // Second request comes from timer to check for changes
      .get('/v1/secret/default/kali/root/password')
      .reply(200, {
        plaintext: 'myvoiceismypassword'
      });

    const client = new TokendClient({
      interval: 100
    });

    client.initialize().then(() => {
      // First request will resolve with the original secret.
      client.get('/v1/secret/default/kali/root/password').then((originalSecret) => {
        expect(originalSecret).to.eql({
          plaintext: 'toor'
        });

        // "update" will have fired once from the initialization; watch for subsequent update polling.
        client.once('update', () => {
          // Second request should resolve with the new secret.
          client.get('/v1/secret/default/kali/root/password').then((updatedSecret) => {
            expect(updatedSecret).to.eql({
              plaintext: 'myvoiceismypassword'
            });

            client.shutdown();

            tokend.done();
            done();
          })
          .catch(done);
        });
      })
      .catch(done);
    })
    .catch(done);
  });
});
