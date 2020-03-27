'use strict';

require('./lib/helpers');

const Properties = require('../src/lib/properties');
const Sources = require('../src/lib/sources');
const Source = require('./lib/stub/source');
const nock = require('nock');
const expect = require('chai').expect;
const providers = {stub: Source.Stub};

Sources.providers.stub = Source.Stub;
Sources.UPDATE_HOLD_DOWN = 100;

describe('Sources', function() {
  describe('Index', function() {
    it('stores configuration parameters passed to the constructor', function() {
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

    it('rejects configuration objects with missing type parameters', function() {
      const index = new Sources.Index([{
        name: 'test-source'
      }]);

      expect(index.order).to.have.length.of(0);
      expect(index.configurations).to.be.empty;
    });

    it('generates a name for configuration objects with missing name parameters', function() {
      const index = new Sources.Index([{
        type: 'test'
      }]);

      expect(index.order.length).to.equal(1);
      const generatedName = index.order[0];

      expect(index.configurations).to.have.key(generatedName);
      expect(generatedName).to.match(/^test:/);
    });

    it('interpolates template values in strings in configuration objects', function() {
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

    it('ignores configuration objects with undefined interpolation parameters', function() {
      const index = new Sources.Index([{
        name: 'test-source',
        type: 'test',
        parameters: {
          bucket: 'water',
          path: 'a road covered in {{ surface:gravel }}',
          waffles: {
            chocolate: '{{ topping }}'
          },
          ignores: 'This {{ thing:because:its:not:defined }}'
        }
      }], {
        surface: {
          gravel: 'small rocks'
        },
        topping: 'fudge!'
      });

      expect(index.order).to.have.length.of(0);
      expect(index.configurations).to.be.empty;
    });

    it('returns an ordered set of sources', function() {
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

  describe('Comparator', function() {
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

    it('detects new sources', function() {
      const diff = Sources.Comparator.compare(one, two);

      expect(diff.changes).to.equal(true);
      expect(diff.create).to.have.length.of(2);
      expect(diff.copy).to.be.empty;
      expect(diff.destroy).to.be.empty;
    });

    it('detects unchanged and removed sources', function() {
      const diff = Sources.Comparator.compare(two, three);

      expect(diff.changes).to.equal(true);
      expect(diff.create).to.have.length.of(1);
      expect(diff.copy).to.have.length.of(1);
      expect(diff.destroy).to.have.length.of(1);
    });

    it('detects changed sources', function() {
      const diff = Sources.Comparator.compare(three, four);

      expect(diff.changes).to.equal(true);
      expect(diff.create).to.have.length.of(1);
      expect(diff.copy).to.have.length.of(1);
      expect(diff.destroy).to.have.length.of(1);
    });

    it('detects when no changes have occurred', function() {
      const diff = Sources.Comparator.compare(three, three);

      expect(diff.changes).to.equal(false);
      expect(diff.create).to.be.empty;
      expect(diff.copy).to.have.length.of(2);
      expect(diff.destroy).to.be.empty;
    });

    it('creates sources for a new index', function() {
      const diff = Sources.Comparator.compare(one, two);
      const index = diff.build(providers);

      expect(index.sources).to.not.be.empty;
      index.ordered().forEach((source) =>
        expect(source).to.be.instanceOf(Source.Stub)
      );
    });

    it('rejects source configurations with unsupported types', function() {
      const diff = Sources.Comparator.compare(one, new Sources.Index([{type: 'foobar'}]));
      const index = diff.build(providers);

      expect(index.sources).to.be.empty;
    });

    it('shuts down removed sources from an old index', function(done) {
      const diff = Sources.Comparator.compare(two, three);

      two.sources['source-one'].once('shutdown', (source) => {
        expect(source.state).to.equal(Source.SHUTDOWN);
        done();
      });

      diff.cleanup();
    });

    it('copies unchanged sources from the previous index', function() {
      const diff = Sources.Comparator.compare(two, three);

      diff.build(providers);

      expect(two.sources['source-two']).to.equal(three.sources['source-two']);
    });
  });

  const setUp = () => {
    const properties = new Properties();
    const layer = new Source.Stub('stub1', {delay: 0});
    const sources = new Sources(properties);
    const index = new Source.IndexStub([{
      type: 'stub',
      name: 'stub1',
      parameters: {
        value: '{{foo}}'
      }
    }, {
      type: 'stub',
      name: 'stub2'
    }]);

    layer.properties = {foo: 'bar'};
    properties.addDynamicLayer(layer);

    return {properties, layer, sources, index};
  };

  describe('Configuration', function() {
    const stubs = setUp();

    it('has the correct initial state', function() {
      stubs.sources.properties.should.be.instanceOf(Properties);
      stubs.sources.indices.should.be.an.Array();
      stubs.sources.initialized.should.be.false();
      stubs.sources.current.should.be.instanceOf(Sources.Index);
      stubs.sources.current.order.should.be.empty();
    });

    it('adds an index source', function() {
      stubs.sources.addIndex(stubs.index);

      expect(stubs.sources.indices).to.deep.equal([stubs.index]);
    });
  });

  describe('Initialization', function() {
    this.timeout(5000);
    const stubs = setUp();

    before(function() {
      nock.disableNetConnect();
    });

    after(function() {
      nock.enableNetConnect();
    });


    stubs.sources.addIndex(stubs.index);

    it('initializes properties and indices', function() {
      stubs.sources.initialize();

      expect(stubs.sources.initializing).to.equal(true);

      // Calling initialize multiple times returns valid promises
      return stubs.sources.initialize().then(() => {
        expect(stubs.index.state).to.equal(Source.RUNNING);
        expect(stubs.properties.sources).to.have.length.of(3);

        stubs.properties.sources.forEach((source) => {
          expect(source.state).to.equal(Source.RUNNING);
        });
      });
    });

    it('returns a resolved promise if called multiple times', function() {
      expect(stubs.sources.initialized).to.equal(true);
      expect(stubs.sources.initialize()).to.be.instanceOf(Promise);
    });

    it('updates the index when a Properties layer updates', function(done) {
      stubs.sources.once('update', () => {
        expect(stubs.sources.current.configurations.stub1.parameters.value).to.equal('quux');
        done();
      });

      stubs.layer.update({foo: 'quux'});
    });

    it('updates the index when an Index layer updates', function(done) {
      stubs.sources.once('update', () => {
        expect(stubs.sources.current.configurations.stub2.parameters.changed).to.equal('parameter!');
        done();
      });

      stubs.index.update([{
        type: 'stub',
        name: 'stub1',
        parameters: {
          value: '{{foo}}'
        }
      }, {
        type: 'stub',
        name: 'stub2',
        parameters: {
          changed: 'parameter!'
        }
      }]);
    });

    it('does not update the properties view when the index isn\'t changed', function(done) {
      stubs.sources.once('noupdate', () => done());
      stubs.index.emit('update');
    });
  });

  describe('Health', function() {
    this.timeout(3000);
    let stubs = null;

    beforeEach(function() {
      stubs = setUp();
      stubs.sources.addIndex(stubs.index);
    });

    afterEach(function() {
      stubs.properties.sources.forEach((s) => {
        s.shutdown();
      });

      stubs.layer.shutdown();
      stubs.index.shutdown();
      stubs.properties.tokendTransformer._client.stop();
    });

    it('sets a healthy code and status message when index and sources are in ready state', function() {
      return stubs.sources.initialize().then(() => {
        stubs.index.state.should.eql(Source.RUNNING);

        stubs.properties.sources.forEach((source) => {
          source.state.should.eql(Source.RUNNING);
        });

        const healthy = stubs.sources.health();

        healthy.code.should.eql(200);
        healthy.status.should.eql('OK');
      });
    });

    // test for any initialising
    it('sets an uninitialized code (503) and status message when all index and sources are uninitialized', function() {
      stubs.sources.initialize();

      stubs.sources.initializing.should.be.true();

      const healthy = stubs.sources.health();

      healthy.code.should.eql(503);
      healthy.status.should.eql('CREATED');
    });

    it('sets an uninitialized code (503) and status message when any index and sources are uninitialized', function() {
      // Leave the index uninitialized
      stubs.properties.sources.forEach((source) => {
        source.initialize().then(() => {
          source.state.should.eql(Source.RUNNING);
        });
      });

      // Test index uninitialized
      stubs.index.state.should.eql(Source.CREATED);

      const healthy = stubs.sources.health();

      healthy.code.should.eql(503);
      healthy.status.should.eql('CREATED');

      stubs.index.state = Source.RUNNING;

      // Test source initializing
      const h2 = stubs.sources.health();

      h2.code.should.eql(503);
      h2.status.should.eql('INITIALIZING');
    });

    it('sets an unhealthy (500) code and status message when an index is in an error state', function() {
      return stubs.sources.initialize().then(() => {
        stubs.index.state.should.eql(Source.RUNNING);

        stubs.index.error();

        stubs.properties.sources.forEach((source) => {
          source.state.should.eql(Source.RUNNING);
        });

        const healthy = stubs.sources.health();

        healthy.code.should.eql(500);
        healthy.status.should.eql('ERROR');
      });
    });

    it('sets an unhealthy code (500) and status message when all sources are in an error state', function() {
      return stubs.sources.initialize().then(() => {
        stubs.index.state.should.eql(Source.RUNNING);

        stubs.properties.sources.forEach((source) => {
          source.state.should.eql(Source.RUNNING);
          source.error();
        });

        stubs.index.state.should.eql(Source.RUNNING);

        const healthy = stubs.sources.health();

        healthy.code.should.eql(500);
        healthy.status.should.eql('ERROR');
      });
    });

    it('sets a healthy code and status message when only some sources are in an error state', function() {
      const layer2 = new Source.Stub('stub2', {delay: 5});

      layer2.properties = {bar: 'foo'};
      stubs.properties.addDynamicLayer(layer2);

      return stubs.sources.initialize().then(() => {
        stubs.index.state.should.eql(Source.RUNNING);

        stubs.properties.sources.forEach((source) => {
          source.state.should.eql(Source.RUNNING);
        });

        stubs.index.state.should.eql(Source.RUNNING);

        const h1 = stubs.sources.health();

        h1.code.should.eql(200);
        h1.status.should.eql('OK');

        layer2.error();

        const h2 = stubs.sources.health();

        h2.code.should.eql(200);
        h2.status.should.eql('OK');
      });
    });
  });
});
