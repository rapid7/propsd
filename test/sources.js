'use strict';

require('./lib/helpers');
require('should');

const Properties = require('../src/lib/properties');
const Sources = require('../src/lib/sources');
const Source = require('./lib/stub/source');
const nock = require('nock');
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

      index.order.should.have.length(1);
      index.configurations.should.eql({
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

      index.order.should.have.length(0);
      index.configurations.should.be.empty();
    });

    it('generates a name for configuration objects with missing name parameters', function() {
      const index = new Sources.Index([{
        type: 'test'
      }]);

      index.order.should.have.length(1);
      const generatedName = index.order[0];

      index.configurations.should.have.keys(generatedName);
      generatedName.should.match(/^test:/);
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

      index.order.should.have.length(1);
      index.configurations.should.eql({
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

      index.order.should.have.length(0);
      index.configurations.should.be.empty();
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

      index.order.should.eql(['first', 'second', 'third']);
      index.ordered().should.eql([
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

      diff.changes.should.be.true();
      diff.create.should.have.length(2);
      diff.copy.should.be.empty();
      diff.destroy.should.be.empty();
    });

    it('detects unchanged and removed sources', function() {
      const diff = Sources.Comparator.compare(two, three);

      diff.changes.should.be.true();
      diff.create.should.have.length(1);
      diff.copy.should.have.length(1);
      diff.destroy.should.have.length(1);
    });

    it('detects changed sources', function() {
      const diff = Sources.Comparator.compare(three, four);

      diff.changes.should.be.true();
      diff.create.should.have.length(1);
      diff.copy.should.have.length(1);
      diff.destroy.should.have.length(1);
    });

    it('detects when no changes have occurred', function() {
      const diff = Sources.Comparator.compare(three, three);

      diff.changes.should.be.false();
      diff.create.should.be.empty();
      diff.copy.should.have.length(2);
      diff.destroy.should.be.empty();
    });

    it('creates sources for a new index', function() {
      const diff = Sources.Comparator.compare(one, two);
      const index = diff.build(providers);

      index.sources.should.not.be.empty();
      index.ordered().forEach((source) => {
        source.should.be.instanceOf(Source.Stub);
      });
    });

    it('rejects source configurations with unsupported types', function() {
      const diff = Sources.Comparator.compare(one, new Sources.Index([{type: 'foobar'}]));
      const index = diff.build(providers);

      index.sources.should.be.empty();
    });

    it('shuts down removed sources from an old index', function(done) {
      const diff = Sources.Comparator.compare(two, three);

      two.sources['source-one'].once('shutdown', (source) => {
        source.state.should.eql(Source.SHUTDOWN);
        done();
      });

      diff.cleanup();
    });

    it('copies unchanged sources from the previous index', function() {
      const diff = Sources.Comparator.compare(two, three);

      diff.build(providers);

      two.sources['source-two'].should.eql(three.sources['source-two']);
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

      stubs.sources.indices.should.eql([stubs.index]);
    });
  });

  describe('Initialization', function() {
    this.timeout(5000);
    const stubs = setUp();

    before(function() {
      nock.disableNetConnect();
    });

    after(function() {
      // We need to ensure that we shut down the Tokend client's polling loop so tests
      // exit correctly.
      stubs.properties.tokendTransformer._client.stop();
      nock.enableNetConnect();
    });


    stubs.sources.addIndex(stubs.index);

    it('initializes properties and indices', function() {
      stubs.sources.initialize();

      stubs.sources.initializing.should.be.true();

      // Calling initialize multiple times returns valid promises
      return stubs.sources.initialize().then(() => {
        stubs.index.state.should.eql(Source.RUNNING);
        stubs.properties.sources.should.have.length(3);

        stubs.properties.sources.forEach((source) => {
          source.state.should.eql(Source.RUNNING);
        });
      });
    });

    it('returns a resolved promise if called multiple times', function() {
      stubs.sources.initialized.should.be.true();
      stubs.sources.initialize().should.be.a.Promise();
    });

    it('updates the index when a Properties layer updates', function(done) {
      stubs.sources.once('update', () => {
        stubs.sources.current.configurations.stub1.parameters.value.should.eql('quux');
        done();
      });

      stubs.layer.update({foo: 'quux'});
    });

    it('updates the index when an Index layer updates', function(done) {
      stubs.sources.once('update', () => {
        stubs.sources.current.configurations.stub2.parameters.changed.should.eql('parameter!');
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
