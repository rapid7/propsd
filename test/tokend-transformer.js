'use strict';

const expect = require('chai').expect;
const nock = require('nock');
const TokendTransformer = require('../lib/transformers/tokend');

describe('TokendTransformer', function () {
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
      host: 'token.d',
      port: 4500
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
      host: 'token.d',
      port: 4500
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
