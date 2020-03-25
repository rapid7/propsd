'use strict';

require('./lib/helpers');

const should = require('should');
const nock = require('nock');
const TokendClient = require('../src/lib/transformers/tokend-client');

describe('TokendClient', function() {
  let _client = null;

  beforeEach(function() {
    nock.cleanAll();
    nock.enableNetConnect();
    if (_client) {
      _client.shutdown();
    }
  });

  afterEach(function() {
    nock.disableNetConnect();
    if (_client) {
      _client.shutdown();
    }
  });

  it('finds Tokend on 127.0.0.1:4500 by default', function() {
    _client = new TokendClient();

    _client._host.should.eql('127.0.0.1');
    _client._port.should.eql(4500);
  });

  it('allows Tokend to be found on a non-default host:port', function() {
    _client = new TokendClient({
      host: 'token.d',
      port: 2600
    });

    _client._host.should.eql('token.d');
    _client._port.should.eql(2600);
  });

  it('only calls Tokend once for each generic secret', function() {
    // Nock clears a response after it's requested.
    // Processing the same secret more than once will fail when tokend.done() is called.
    const tokend = nock('http://127.0.0.1:4500')
      .get('/v1/secret/default/kali/root/password')
      .reply(200, {
        plaintext: 'toor'
      });

    _client = new TokendClient();

    const secret1 = _client.get('/v1/secret/default/kali/root/password');
    const secret2 = _client.get('/v1/secret/default/kali/root/password');

    return Promise.all([secret1, secret2]).then((secrets) => {
      secrets.forEach((secret) => {
        secret.should.eql({
          plaintext: 'toor'
        });
      });

      tokend.done();
    }).catch((ex) => console.log(ex));
  });

  it('emits "update" events when generic secrets in Tokend change', function() {
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

    _client = new TokendClient();

    return _client.initialize().then(() => {
      // First request will resolve with the original secret.
      _client.get('/v1/secret/default/kali/root/password').then((originalSecret) => {
        originalSecret.should.eql({
          plaintext: 'toor'
        });

        // "update" will have fired once from the initialization; watch for subsequent update polling.
        _client.once('update', () => {
          // Second request should resolve with the new secret.
          _client.get('/v1/secret/default/kali/root/password').then((updatedSecret) => {
            updatedSecret.should.eql({
              plaintext: 'myvoiceismypassword'
            });

            tokend.done();
          });
        });
      });
    });
  });

  it('only calls Tokend once for each transit secret', function() {
    // Nock clears a response after it's requested.
    // Processing the same secret more than once will fail when tokend.done() is called.
    const tokend = nock('http://127.0.0.1:4500')
      .post('/v1/transit/default/decrypt', {
        key: 'kali',
        ciphertext: 'gbbe'
      })
      .reply(200, {
        plaintext: 'toor'
      });

    _client = new TokendClient();

    const secret1 = _client.post('/v1/transit/default/decrypt', {key: 'kali', ciphertext: 'gbbe'});
    const secret2 = _client.post('/v1/transit/default/decrypt', {key: 'kali', ciphertext: 'gbbe'});

    return Promise.all([secret1, secret2]).then((secrets) => {
      secrets.forEach((secret) => {
        secret.should.eql({
          plaintext: 'toor'
        });
      });

      tokend.done();
    });
  });

  it('provides a method for clearing the request cache', function() {
    const tokend = nock('http://127.0.0.1:4500')
      .post('/v1/transit/default/decrypt', {
        key: 'kali',
        ciphertext: 'gbbe'
      })
      .reply(200, {
        plaintext: 'toor'
      });

    _client = new TokendClient();

    const keyId = '/v1/transit/default/decrypt.kali.gbbe';

    return _client.post('/v1/transit/default/decrypt', {key: 'kali', ciphertext: 'gbbe'}).then(() => {
      const postRequestQueue = _client._pendingPostRequests;

      Object.keys(postRequestQueue).should.have.length(1);
      postRequestQueue[keyId].should.be.a.Promise();

      _client.clearCacheAtKey('POST', keyId);

      Object.keys(postRequestQueue).should.have.length(0);

      tokend.done();
    });
  });

  it('throws an error if attempting to clear a non-existent cache', function() {
    const tokend = nock('http://127.0.0.1:4500')
      .post('/v1/transit/default/decrypt', {
        key: 'kali',
        ciphertext: 'gbbe'
      })
      .reply(200, {
        plaintext: 'toor'
      });

    _client = new TokendClient();

    const keyId = '/v1/transit/default/decrypt.kali.gbbe';

    return _client.post('/v1/transit/default/decrypt', {key: 'kali', ciphertext: 'gbbe'}).then(() => {
      should.throws(() => _client.clearCacheAtKey('HEAD', keyId), Error, 'A HEAD request does not map to an' +
        ' existing cache.');
      tokend.done();
    });
  });
});
