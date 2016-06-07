'use strict';

/* eslint-env mocha */
/* global Config, Log */
/* eslint-disable max-nested-callbacks, no-unused-expressions */

require('./lib/helpers');

const Properties = require('../lib/properties');
const Sources = require('../lib/sources');
const Source = require('./lib/stub/source');

const expect = require('chai').expect;
const providers = {stub: Source.Stub};

Sources.providers.stub = Source.Stub;
Sources.UPDATE_HOLD_DOWN = 100;

describe('Sources', function _() {
  describe('Index', function __() {
    it('stores configuration parameters passed to the constructor', function ___() {
      const index = new Sources.Index([{
        name: 'test-source',
        type: 'test'
      }]);

      expect(index.order).to.have.length.of(1);
      expect(index.configurations).to.deep.equal({
        'test-source': {
          name: 'test-source',
          type: 'test'
        }
      });
    });

    it('rejects configuration objects with missing type parameters', function ___() {
      const index = new Sources.Index([{
        name: 'test-source'
      }]);

      expect(index.order).to.have.length.of(0);
      expect(index.configurations).to.be.empty;
    });

    it('generates a name for configuration objects with missing name parameters', function ___() {
      const index = new Sources.Index([{
        type: 'test'
      }]);

      expect(index.order.length).to.equal(1);
      const generatedName = index.order[0];

      expect(index.configurations).to.have.key(generatedName);
      expect(generatedName).to.match(/^test:/);
    });

    it('interpolates template values in strings in configuration objects', function ___() {
      const index = new Sources.Index([{
        name: 'test-source',
        type: 'test',
        parameters: {
          bucket: 'water',
          path: 'a road covered in {{ surface:gravel }}',
          waffles: {
            chocolate: '{{ topping }}'
          }
        }
      }], {
        surface: {
          gravel: 'small rocks'
        },
        topping: 'fudge!'
      });

      expect(index.order).to.have.length.of(1);
      expect(index.configurations).to.deep.equal({
        'test-source': {
          name: 'test-source',
          type: 'test',
          parameters: {
            bucket: 'water',
            path: 'a road covered in small rocks',
            waffles: {
              chocolate: 'fudge!'
            }
          }
        }
      });
    });

    it('returns an ordered set of sources', function ___() {
      const index = new Sources.Index([{
        name: 'first',
        type: 'test'
      }, {
        name: 'second',
        type: 'test'
      }, {
        name: 'third',
        type: 'test'
      }]);

      // Put something useful into the sources object to test against
      index.sources = {
        first: {
          name: 'first'
        },
        second: {
          name: 'second'
        },
        third: {
          name: 'third'
        }
      };

      expect(index.order).to.deep.equal(['first', 'second', 'third']);
      expect(index.ordered()).to.deep.equal([
        {name: 'first'},
        {name: 'second'},
        {name: 'third'}
      ]);
    });
  });

  describe('Comparator', function __() {
    const one = new Sources.Index([]);
    const two = new Sources.Index([{
      name: 'source-one',
      type: 'stub'
    }, {
      name: 'source-two',
      type: 'stub',
      parameters: {foo: 'bar'}
    }]);
    const three = new Sources.Index([{
      name: 'source-two',
      type: 'stub',
      parameters: {foo: 'bar'}
    }, {
      name: 'source-three',
      type: 'stub',
      parameters: {foo: 'baz'}
    }]);
    const four = new Sources.Index([{
      name: 'source-two',
      type: 'stub',
      parameters: {foo: 'quux'}
    }, {
      name: 'source-three',
      type: 'stub',
      parameters: {foo: 'baz'}
    }]);

    it('detects new sources', function ___() {
      const diff = Sources.Comparator.compare(one, two);

      expect(diff.changes).to.equal(true);
      expect(diff.create).to.have.length.of(2);
      expect(diff.copy).to.be.empty;
      expect(diff.destroy).to.be.empty;
    });

    it('detects unchanged and removed sources', function ___() {
      const diff = Sources.Comparator.compare(two, three);

      expect(diff.changes).to.equal(true);
      expect(diff.create).to.have.length.of(1);
      expect(diff.copy).to.have.length.of(1);
      expect(diff.destroy).to.have.length.of(1);
    });

    it('detects changed sources', function ___() {
      const diff = Sources.Comparator.compare(three, four);

      expect(diff.changes).to.equal(true);
      expect(diff.create).to.have.length.of(1);
      expect(diff.copy).to.have.length.of(1);
      expect(diff.destroy).to.have.length.of(1);
    });

    it('detects when no changes have occurred', function ___() {
      const diff = Sources.Comparator.compare(three, three);

      expect(diff.changes).to.equal(false);
      expect(diff.create).to.be.empty;
      expect(diff.copy).to.have.length.of(2);
      expect(diff.destroy).to.be.empty;
    });

    it('creates sources for a new index', function ___() {
      const diff = Sources.Comparator.compare(one, two);
      const index = diff.build(providers);

      expect(index.sources).to.not.be.empty;
      index.ordered().forEach((source) =>
        expect(source).to.be.instanceOf(Source.Stub)
      );
    });

    it('rejects source configurations with unsupported types', function ___() {
      const diff = Sources.Comparator.compare(one, new Sources.Index([{type: 'foobar'}]));
      const index = diff.build(providers);

      expect(index.sources).to.be.empty;
    });

    it('shuts down removed sources from an old index', function ___(done) {
      const diff = Sources.Comparator.compare(two, three);

      two.sources['source-one'].once('shutdown', (source) => {
        expect(source.state).to.equal(Source.SHUTDOWN);
        done();
      });

      diff.cleanup();
    });

    it('copies unchanged sources from the previous index', function ___() {
      const diff = Sources.Comparator.compare(two, three);

      diff.build(providers);

      expect(two.sources['source-two']).to.equal(three.sources['source-two']);
    });
  });

  const properties = new Properties();
  const sources = new Sources(properties);
  const index = new Source.IndexStub('stub', [{
    type: 'stub',
    name: 'stub1'
  }, {
    type: 'stub',
    name: 'stub2'
  }]);

  describe('Configuration', function __() {
    it('has the correct initial state', function ___() {
      expect(sources.properties).to.be.instanceOf(Properties);
      expect(sources.indices).to.be.instanceOf(Array);
      expect(sources.initialized).to.equal(false);
      expect(sources.current).to.be.instanceOf(Sources.Index);
      expect(sources.current.order).to.have.length.of(0);
    });

    it('adds an index source', function ___() {
      sources.index(index);

      expect(sources.indices).to.deep.equal([index]);
    });
  });

  describe('Initialization', function __() {
    this.timeout(5000);

    it('initializes properties and indices', function ___(done) {
      sources.initialize()
        .then(() => {
          expect(index.state).to.equal(Source.RUNNING);
          expect(properties.sources).to.have.length.of(2);

          properties.sources.forEach((source) =>
            expect(source.state).to.equal(Source.RUNNING));

          done();
        })
        .catch(done);
    });
  });

  describe('health', function __() {

  });
});
