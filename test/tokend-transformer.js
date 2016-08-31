'use strict';

const expect = require('chai').expect;
const TokendTransformer = require('../lib/transformers/tokend');

describe('TokendTransformer', function () {
  it('ignores non-$tokend properties', function (done) {
    const untransformedProperties = {
      key: 'value'
    };

    const transformer = new TokendTransformer();

    transformer.transform(untransformedProperties)
      .then((transformedProperties) => {
        expect(untransformedProperties).to.eql(transformedProperties);

        done();
      })
      .catch(done);
  });
});
