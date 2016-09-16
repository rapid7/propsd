'use strict';

const expect = require('chai').expect;
const nock = require('nock');
const TokendTransformer = require('../lib/transformers/tokend');
const Properties = require('../lib/properties');
const Source = require('./lib/stub/source');

// Speed up testing by shortening the time we wait for properties to build.
Properties.BUILD_HOLD_DOWN = 100;

describe('TokendTransformer', function () {
  it('finds tokend on 127.0.0.1:4500 by default', function () {
    const transformer = new TokendTransformer();

    expect(transformer.host).to.equal('127.0.0.1');
    expect(transformer.port).to.equal(4500);
  });

  it('allows tokend to be found on a non-default host:port', function () {
    const transformer = new TokendTransformer({
      host: 'tokend.d',
      port: 2600
    });

    expect(transformer.host).to.equal('tokend.d');
    expect(transformer.port).to.equal(2600);
  });

  it('transforms null properties', function (done) {
    const transformer = new TokendTransformer();

    transformer.transform(null)
      .then((transformedProperties) => {
        expect(transformedProperties).to.eql({});

        done();
      })
      .catch(done);
  });

  it('transforms undefined properties', function (done) {
    const transformer = new TokendTransformer();

    transformer.transform(undefined)
      .then((transformedProperties) => {
        expect(transformedProperties).to.eql({});

        done();
      })
      .catch(done);
  });

  it('transforms empty properties', function (done) {
    const transformer = new TokendTransformer();

    transformer.transform({})
      .then((transformedProperties) => {
        expect(transformedProperties).to.eql({});

        done();
      })
      .catch(done);
  });

  it('transforms $tokend properties', function (done) {
    const untransformedProperties = {
      password: {
        $tokend: {
          type: 'generic',
          resource: '/v1/secret/default/kali/root/password'
        }
      }
    };

    nock.cleanAll();
    const tokend = nock('http://token.d:4500')
      .get('/v1/secret/default/kali/root/password')
      .reply(200, {
        plaintext: 'toor'
      });

    const transformer = new TokendTransformer({
      host: 'token.d'
    });

    transformer.transform(untransformedProperties)
      .then((transformedProperties) => {
        expect(untransformedProperties).to.not.eql(transformedProperties);
        expect(transformedProperties).to.eql({
          password: 'toor'
        });

        tokend.done();
        done();
      })
      .catch(done);
  });

  it('transforms nested $tokend properties', function (done) {
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

    nock.cleanAll();
    const tokend = nock('http://token.d:4500')
      .get('/v1/secret/default/kali/root/password')
      .reply(200, {
        plaintext: 'toor'
      });

    const transformer = new TokendTransformer({
      host: 'token.d'
    });

    transformer.transform(untransformedProperties)
      .then((transformedProperties) => {
        expect(untransformedProperties).to.not.eql(transformedProperties);
        expect(transformedProperties).to.eql({
          database: {
            password: 'toor'
          }
        });

        tokend.done();
        done();
      })
      .catch(done);
  });

  it('transforms multiple $tokend properties', function (done) {
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

    nock.cleanAll();
    const tokend = nock('http://token.d:4500')
        .get('/v1/secret/default/kali/root/password')
        .reply(200, {
          plaintext: 'toor'
        })
        .get('/v1/secret/default/kali/user/password')
        .reply(200, {
          plaintext: 'resu'
        });

    const transformer = new TokendTransformer({
      host: 'token.d'
    });

    transformer.transform(untransformedProperties)
      .then((transformedProperties) => {
        expect(untransformedProperties).to.not.eql(transformedProperties);
        expect(transformedProperties).to.eql({
          database: {
            'root-password': 'toor',
            'user-password': 'resu'
          }
        });

        tokend.done();
        done();
      })
      .catch(done);
  });

  it('ignores non-$tokend properties', function (done) {
    const untransformedProperties = {
      key: 'value'
    };

    const transformer = new TokendTransformer();

    transformer.transform(untransformedProperties)
      .then((transformedProperties) => {
        expect(transformedProperties).to.eql({});

        done();
      })
      .catch(done);
  });

  it('throws an error if $tokend has no "resource" key', function (done) {
    const untransformedProperties = {
      password: {
        $tokend: {
          type: 'generic',

          // This is "resources" instead of "resource"
          resources: '/v1/secret/default/kali/root/password'
        }
      }
    };

    const transformer = new TokendTransformer({
      host: 'token.d'
    });

    transformer.transform(untransformedProperties)
      .then(() => done(new Error('No error for invalid $tokend.resource key')))
      .catch((err) => {
        expect(err).to.be.instanceOf(Error);

        done();
      });
  });

  it('throws an error if $tokend.type is not "generic"', function (done) {
    const untransformedProperties = {
      password: {
        $tokend: {

          // This is "generics" instead of "generic"
          type: 'generics',
          resource: '/v1/secret/default/kali/root/password'
        }
      }
    };

    const transformer = new TokendTransformer({
      host: 'token.d'
    });

    transformer.transform(untransformedProperties)
      .then(() => done(new Error('No error for invalid $tokend.type key')))
      .catch((err) => {
        expect(err).to.be.instanceOf(Error);

        done();
      });
  });

  it('throws an error if the secret is not in a "plaintext" key', function (done) {
    const untransformedProperties = {
      password: {
        $tokend: {
          type: 'generic',
          resource: '/v1/secret/default/kali/root/password'
        }
      }
    };

    nock.cleanAll();
    const tokend = nock('http://token.d:4500')
      .get('/v1/secret/default/kali/root/password')
      .reply(200, {

        // This is "plaintexts" instead of "plaintext"
        plaintexts: 'toor'
      });

    const transformer = new TokendTransformer({
      host: 'token.d'
    });

    transformer.transform(untransformedProperties)
      .then(() => done(new Error('No error for missing "plaintext" key in Vault')))
      .catch((err) => {
        expect(err).to.be.instanceOf(Error);

        tokend.done();
        done();
      });
  });

  it('throws an error if the secret is not JSON', function (done) {
    const untransformedProperties = {
      password: {
        $tokend: {
          type: 'generic',
          resource: '/v1/secret/default/kali/root/password'
        }
      }
    };

    nock.cleanAll();
    const tokend = nock('http://token.d:4500')
        .get('/v1/secret/default/kali/root/password')
        .reply(200, 'toor');

    const transformer = new TokendTransformer({
      host: 'token.d'
    });

    transformer.transform(untransformedProperties)
      .then(() => done(new Error('No error for invalid JSON secret in Vault')))
      .catch((err) => {
        expect(err).to.be.instanceOf(Error);

        tokend.done();
        done();
      });
  });
});

describe('Properties#build', function () {
  it('transformers $tokend objects in static properties', function (done) {
    nock.cleanAll();
    const tokend = nock('http://127.0.0.1:4500')
        .get('/v1/secret/default/kali/root/password')
        .reply(200, {
          plaintext: 'toor'
        });

    const properties = new Properties();

    properties.static({
      password: {
        $tokend: {
          type: 'generic',
          resource: '/v1/secret/default/kali/root/password'
        }
      }
    });

    properties.once('build', (transformedProperties) => {
      expect(transformedProperties).to.be.instanceOf(Object);
      expect(transformedProperties).to.eql({
        password: 'toor'
      });

      tokend.done();
      done();
    });

    properties.build();
  });

  it('transforms $tokend objects in dynamic properties', function (done) {
    nock.cleanAll();
    const tokend = nock('http://127.0.0.1:4500')
        .get('/v1/secret/default/kali/root/password')
        .reply(200, {
          plaintext: 'toor'
        });

    const properties = new Properties();

    properties.dynamic(new Source.Stub({
      password: {
        $tokend: {
          type: 'generic',
          resource: '/v1/secret/default/kali/root/password'
        }
      }
    }));

    properties.once('build', (transformedProperties) => {
      expect(transformedProperties).to.be.instanceOf(Object);
      expect(transformedProperties).to.eql({
        password: 'toor'
      });

      tokend.done();
      done();
    });

    properties.build();
  });

  it('transforms $tokend objects after they are merged', function (done) {
    nock.cleanAll();
    const tokend = nock('http://127.0.0.1:4500')
        .get('/v1/secret/default/kali/root/password')
        .reply(200, {
          plaintext: 'toor'
        });

    const properties = new Properties();

    properties.dynamic(new Source.Stub({
      password: {
        $tokend: {
          type: 'generic',

          // This kali/root/password will overwrite the kali/user/password.
          resource: '/v1/secret/default/kali/root/password'
        }
      }
    }));

    properties.dynamic(new Source.Stub({
      password: {
        $tokend: {
          type: 'generic',

          // This is looking for a kali/user/password key which doesn't exist.
          resource: '/v1/secret/default/kali/user/password'
        }
      }
    }));

    properties.once('build', (transformedProperties) => {
      expect(transformedProperties).to.be.instanceOf(Object);
      expect(transformedProperties).to.eql({
        password: 'toor'
      });

      tokend.done();
      done();
    });

    properties.build();
  });
});
