'use strict';

const should = require('should');
const util = require('../src/lib/util');

describe('Util/getNestedProperty', function() {
  const getNestedProperty = util.getNestedProperty;
  const someObject = {
    some: {
      ips: [1, 2, 3, 4]
    },
    cool: {
      tacos: {
        types: ['carnitas', 'al pastor', 'steak', 'chicken', 'barbacoa', 'lengua'],
        meats: ['pork', 'chicken', 'beef'],
        status: 'delicious'
      }
    },
    object: {
      with: {
        nested: {
          keys: 'foobar'
        }
      }
    }
  };

  it('retrieves a nested value', function() {
    getNestedProperty(someObject, ['cool', 'tacos', 'status']).should.equal('delicious');
    getNestedProperty(someObject, 'object.with.nested.keys'.split('.')).should.equal('foobar');
  });

  it('returns the correct type when the nested path ends', function() {
    getNestedProperty(someObject, 'cool.tacos.types'.split('.')).should.be.an.Array();
    getNestedProperty(someObject, 'object.with'.split('.')).should.be.an.Object();
  });

  it('retrieves a nested value at an arbitrary level', function() {
    getNestedProperty(someObject, ['cool']).should.eql({
      tacos: {
        types: ['carnitas', 'al pastor', 'steak', 'chicken', 'barbacoa', 'lengua'],
        meats: ['pork', 'chicken', 'beef'],
        status: 'delicious'
      }
    });

    getNestedProperty(someObject, 'object.with'.split('.')).should.eql({
      nested: {
        keys: 'foobar'
      }
    });
  });

  it('throws a TypeError with info if a key doesn\'t exist', function() {
    should.throws(() => {
      getNestedProperty(someObject, 'cool.burgers.status'.split('.'));
    }, TypeError, `Key 'burgers' does not exist in object ${JSON.stringify(someObject.cool)}`);
  });
});
