'use strict';

require('./lib/helpers');

const expect = require('chai').expect;
const nock = require('nock');
const TokendTransformer = require('../dist/lib/transformers/tokend');
const Properties = require('../dist/lib/properties');
const Source = require('./lib/stub/source');

// Speed up testing by shortening the time we wait for properties to build.
Properties.BUILD_HOLD_DOWN = 10;

describe('TokendTransformer', function() {
  let _transformer = null;

  beforeEach(function() {
    nock.cleanAll();

    if (_transformer) {
      _transformer._client.shutdown();
    }
  });

  afterEach(function() {
    if (_transformer) {
      _transformer._client.shutdown();
    }
  });

  it('transforms null properties', function() {
    const untransformedProperties = null;

    _transformer = new TokendTransformer();

    return _transformer.transform(untransformedProperties).then((transformedProperties) => {
      expect(transformedProperties).to.eql({});
    });
  });

  it('transforms undefined properties', function() {
    const untransformedProperties = undefined;

    _transformer = new TokendTransformer();

    return _transformer.transform(untransformedProperties).then((transformedProperties) => {
      expect(transformedProperties).to.eql({});
    });
  });

  it('transforms empty properties', function() {
    const untransformedProperties = {};

    _transformer = new TokendTransformer();

    return _transformer.transform(untransformedProperties).then((transformedProperties) => {
      expect(transformedProperties).to.eql({});
    });
  });

  it('transforms $tokend properties', function() {
    const untransformedProperties = {
      password: {
        $tokend: {
          type: 'generic',
          resource: '/v1/secret/default/kali/root/password'
        }
      }
    };

    const tokend = nock('http://127.0.0.1:4500')
      .get('/v1/secret/default/kali/root/password')
      .reply(200, {
        plaintext: 'toor'
      });

    _transformer = new TokendTransformer();

    return _transformer.transform(untransformedProperties).then((transformedProperties) => {
      expect(transformedProperties).to.eql({
        password: 'toor'
      });

      tokend.done();
    });
  });

  it('transforms transit $tokend properties', function() {
    const untransformedProperties = {
      password: {
        $tokend: {
          type: 'transit',
          resource: '/v1/transit/default/decrypt',
          key: 'kali',
          ciphertext: 'gbbe'
        }
      }
    };

    const tokend = nock('http://127.0.0.1:4500')
      .post('/v1/transit/default/decrypt', {
        key: 'kali',
        ciphertext: 'gbbe'
      })
      .reply(200, {
        plaintext: 'toor'
      });

    _transformer = new TokendTransformer();

    return _transformer.transform(untransformedProperties).then((transformedProperties) => {
      expect(transformedProperties).to.eql({
        password: 'toor'
      });

      tokend.done();
    });
  });

  it('transforms KMS $tokend properties with region supplied', function() {
    const untransformedProperties = {
      password: {
        $tokend: {
          type: 'kms',
          resource: '/v1/kms/decrypt',
          ciphertext: 'gbbe',
          region: 'eu-central-1'
        }
      }
    };

    const tokend = nock('http://127.0.0.1:4500')
        .post('/v1/kms/decrypt', {
          ciphertext: 'gbbe',
          region: 'eu-central-1'
        })
        .reply(200, {
          plaintext: 'toor',
          keyid: 'arn:aws:kms:region:account-id:key/key-id'
        });

    _transformer = new TokendTransformer();

    return _transformer.transform(untransformedProperties).then((transformedProperties) => {
      expect(transformedProperties).to.eql({
        password: 'toor'
      });

      tokend.done();
    });
  });

  it('transforms KMS $tokend properties without region', function() {
    const untransformedProperties = {
      password: {
        $tokend: {
          type: 'kms',
          resource: '/v1/kms/decrypt',
          ciphertext: 'gbbe'
        }
      }
    };

    const tokend = nock('http://127.0.0.1:4500')
        .post('/v1/kms/decrypt', {
          ciphertext: 'gbbe'
        })
        .reply(200, {
          plaintext: 'toor',
          keyid: 'arn:aws:kms:region:account-id:key/key-id'
        });

    _transformer = new TokendTransformer();

    return _transformer.transform(untransformedProperties).then((transformedProperties) => {
      expect(transformedProperties).to.eql({
        password: 'toor'
      });

      tokend.done();
    });
  });

  it('transforms KMS $tokend properties with a datakey value', function() {
    const untransformedProperties = {
      password: {
        $tokend: {
          type: 'kms',
          resource: '/v1/kms/decrypt',
          ciphertext: 'gbbe',
          datakey: 'foobar'
        }
      }
    };

    const tokend = nock('http://127.0.0.1:4500')
        .post('/v1/kms/decrypt', {
          ciphertext: 'gbbe',
          datakey: 'foobar'
        })
        .reply(200, {
          plaintext: 'toor',
          keyid: 'arn:aws:kms:region:account-id:key/key-id'
        });

    _transformer = new TokendTransformer();

    return _transformer.transform(untransformedProperties).then((transformedProperties) => {
      expect(transformedProperties).to.eql({
        password: 'toor'
      });

      tokend.done();
    });
  });

  it('transforms KMS $tokend properties without a datakey value', function() {
    const untransformedProperties = {
      password: {
        $tokend: {
          type: 'kms',
          resource: '/v1/kms/decrypt',
          ciphertext: 'gbbe'
        }
      }
    };

    const tokend = nock('http://127.0.0.1:4500')
        .post('/v1/kms/decrypt', {
          ciphertext: 'gbbe'
        })
        .reply(200, {
          plaintext: 'toor',
          keyid: 'arn:aws:kms:region:account-id:key/key-id'
        });

    _transformer = new TokendTransformer();

    return _transformer.transform(untransformedProperties).then((transformedProperties) => {
      expect(transformedProperties).to.eql({
        password: 'toor'
      });

      tokend.done();
    });
  });

  it('transforms nested $tokend properties', function() {
    const untransformedProperties = {
      database: {
        password: {
          $tokend: {
            type: 'generic',
            resource: '/v1/secret/default/kali/root/password'
          }
        }
      }
    };

    const tokend = nock('http://127.0.0.1:4500')
      .get('/v1/secret/default/kali/root/password')
      .reply(200, {
        plaintext: 'toor'
      });

    _transformer = new TokendTransformer();

    return _transformer.transform(untransformedProperties).then((transformedProperties) => {
      expect(transformedProperties).to.eql({
        database: {
          password: 'toor'
        }
      });

      tokend.done();
    });
  });

  it('transforms multiple $tokend properties', function() {
    const untransformedProperties = {
      database: {
        'root-password': {
          $tokend: {
            type: 'generic',
            resource: '/v1/secret/default/kali/root/password'
          }
        },
        'user-password': {
          $tokend: {
            type: 'generic',
            resource: '/v1/secret/default/kali/user/password'
          }
        }
      }
    };

    const tokend = nock('http://127.0.0.1:4500')
        .get('/v1/secret/default/kali/root/password')
        .reply(200, {
          plaintext: 'toor'
        })
        .get('/v1/secret/default/kali/user/password')
        .reply(200, {
          plaintext: 'resu'
        });

    _transformer = new TokendTransformer();

    return _transformer.transform(untransformedProperties).then((transformedProperties) => {
      expect(transformedProperties).to.eql({
        database: {
          'root-password': 'toor',
          'user-password': 'resu'
        }
      });

      tokend.done();
    });
  });

  it('ignores non-$tokend properties', function() {
    const untransformedProperties = {
      key: 'value'
    };

    _transformer = new TokendTransformer();

    return _transformer.transform(untransformedProperties).then((transformedProperties) => {
      expect(transformedProperties).to.eql({});
    });
  });

  it('resolves a null property value if $tokend has no "resource" key', function() {
    const untransformedProperties = {
      password: {
        $tokend: {
          type: 'generic',

          // This is "resources" instead of "resource"
          resources: '/v1/secret/default/kali/root/password'
        }
      }
    };

    _transformer = new TokendTransformer();

    return _transformer.transform(untransformedProperties).then((transformedProperties) => {
      expect(transformedProperties).to.eql({
        password: null
      });
    });
  });

  it('resolves a null property value if $tokend.type is not "generic"', function() {
    const untransformedProperties = {
      password: {
        $tokend: {

          // This is "generics" instead of "generic"
          type: 'generics',
          resource: '/v1/secret/default/kali/root/password'
        }
      }
    };

    _transformer = new TokendTransformer();

    return _transformer.transform(untransformedProperties).then((transformedProperties) => {
      expect(transformedProperties).to.eql({
        password: null
      });
    });
  });

  it('resolves a null property value if the secret is not in a "plaintext" key', function() {
    const untransformedProperties = {
      password: {
        $tokend: {
          type: 'generic',
          resource: '/v1/secret/default/kali/root/password'
        }
      }
    };

    const tokend = nock('http://127.0.0.1:4500')
      .get('/v1/secret/default/kali/root/password')
      .reply(200, {

        // This is "plaintexts" instead of "plaintext"
        plaintexts: 'toor'
      });

    _transformer = new TokendTransformer();

    return _transformer.transform(untransformedProperties).then((transformedProperties) => {
      expect(transformedProperties).to.eql({
        password: null
      });

      tokend.done();
    });
  });

  it('resolves a null property value if the secret is not JSON', function() {
    const untransformedProperties = {
      password: {
        $tokend: {
          type: 'generic',
          resource: '/v1/secret/default/kali/root/password'
        }
      }
    };

    const tokend = nock('http://127.0.0.1:4500')
        .get('/v1/secret/default/kali/root/password')
        .reply(200, 'toor');

    _transformer = new TokendTransformer();

    return _transformer.transform(untransformedProperties).then((transformedProperties) => {
      expect(transformedProperties).to.eql({
        password: null
      });

      tokend.done();
    });
  });
});

describe('Properties#build', function() {
  let _properties = null;

  beforeEach(function() {
    nock.cleanAll();

    if (_properties) {
      _properties.tokendTransformer._client.shutdown();
    }
  });

  afterEach(function() {
    if (_properties) {
      _properties.tokendTransformer._client.shutdown();
    }
  });

  it('transforms $tokend objects in static properties', function(done) {
    const tokend = nock('http://127.0.0.1:4500')
        .get('/v1/secret/default/kali/root/password')
        .reply(200, {
          plaintext: 'toor'
        });

    _properties = new Properties();

    _properties.static({
      password: {
        $tokend: {
          type: 'generic',
          resource: '/v1/secret/default/kali/root/password'
        }
      }
    });

    _properties.once('build', (transformedProperties) => {
      expect(transformedProperties).to.eql({
        password: 'toor'
      });

      tokend.done();
      done();
    });

    _properties.build();
  });

  it('transforms $tokend objects in dynamic properties', function(done) {
    const tokend = nock('http://127.0.0.1:4500')
        .get('/v1/secret/default/kali/root/password')
        .reply(200, {
          plaintext: 'toor'
        });
    const stub = new Source.Stub();

    stub.properties = {
      password: {
        $tokend: {
          type: 'generic',
          resource: '/v1/secret/default/kali/root/password'
        }
      }
    };
    _properties = new Properties();

    _properties.dynamic(stub);

    _properties.once('build', (transformedProperties) => {
      expect(transformedProperties).to.eql({
        password: 'toor'
      });

      tokend.done();
      done();
    });

    _properties.build();
  });

  it('transforms $tokend objects after they are merged', function(done) {
    const tokend = nock('http://127.0.0.1:4500')
        .get('/v1/secret/default/kali/root/password')
        .reply(200, {
          plaintext: 'toor'
        });
    const stub = new Source.Stub();
    const stub2 = new Source.Stub();

    stub.properties = {
      password: {
        $tokend: {
          type: 'generic',

          // This is looking for a kali/user/password key which doesn't exist.
          resource: '/v1/secret/default/kali/user/password'
        }
      }
    };
    stub2.properties = {
      password: {
        $tokend: {
          type: 'generic',

          // This kali/root/password will overwrite the kali/user/password.
          resource: '/v1/secret/default/kali/root/password'
        }
      }
    };

    _properties = new Properties();

    _properties.dynamic(stub);
    _properties.dynamic(stub2);

    _properties.once('build', (transformedProperties) => {
      expect(transformedProperties).to.eql({
        password: 'toor'
      });

      tokend.done();
      done();
    });

    _properties.build();
  });

  // This isn't working in Travis CI. There are timing issue regarding populating the cache
  // from the initial fetch and polling for changes. We're not supporting generic secrets
  // right now, and polling doesn't impact transit secrets, so skip this test.
  it.skip('builds new properties when generic secrets in Tokend change', function(done) {
    const tokend = nock('http://127.0.0.1:4500')

      // First request comes from Properties.initialize() call
      .get('/v1/secret/default/kali/root/password')
      .reply(200, {
        plaintext: 'toor'
      })

      // Second request comes from timer to check for changes
      .get('/v1/secret/default/kali/root/password')
      .reply(200, {
        plaintext: 'myvoiceismypassword'
      });
    const stub = new Source.Stub();

    stub.properties = {
      password: {
        $tokend: {
          type: 'generic',

          // This kali/root/password will overwrite the kali/user/password.
          resource: '/v1/secret/default/kali/root/password'
        }
      }
    };
    _properties = new Properties();

    _properties.dynamic(stub);

    // "build" will have fired once from the initialization; watch for updates from polling
    _properties.on('build', (updatedProperties) => {
      if (updatedProperties && updatedProperties.password === 'myvoiceismypassword') {
        tokend.done();
        done();
      }
    });

    _properties.initialize().then((initializedProperties) => {
      // First request will resolve with the original secret.
      expect(initializedProperties.properties).to.eql({
        password: 'toor'
      });
    }).catch(done);
  });
});
