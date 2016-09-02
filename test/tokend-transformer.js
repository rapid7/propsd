'use strict';

const expect = require('chai').expect;
const nock = require('nock');
const TokendTransformer = require('../lib/transformers/tokend');

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

  it('transforms $tokend properties', function (done) {
    const untransformedProperties = {
      password: {
        $tokend: {
          type: 'secret',
          resource: '/v1/secret/default/kali/root/password'
        }
      }
    };

    nock('http://token.d:4500')
      .get('/v1/secret/default/kali/root/password')
      .reply(200, {
        secret: 'toor'
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

        done();
      })
      .catch(done);
  });

  it('transforms nested $tokend properties', function (done) {
    const untransformedProperties = {
      database: {
        password: {
          $tokend: {
            type: 'secret',
            resource: '/v1/secret/default/kali/root/password'
          }
        }
      }
    };

    nock('http://token.d:4500')
      .get('/v1/secret/default/kali/root/password')
      .reply(200, {
        secret: 'toor'
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
});
