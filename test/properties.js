'use strict';

require('./lib/helpers');

const nock = require('nock');

const Properties = require('../src/lib/properties');
const View = require('../src/lib/properties/view');
const Source = require('./lib/stub/source');
const merge = require('../src/lib/util').merge;

// Shorten build hold-down timeout for testing
Properties.BUILD_HOLD_DOWN = 100;

const should = require('should');

describe('Properties', function() {
  const properties = new Properties();

  before(function() {
    nock.disableNetConnect();
  });

  after(function() {
    // We need to ensure that we shut down the Tokend client's polling loop so tests
    // exit correctly.
    properties.tokendTransformer._client.stop();
    nock.enableNetConnect();
  });

  it('adds static properties and builds', function(done) {
    properties.addStaticLayer({
      hello: 'world'
    });

    properties.layers.should.have.length(1);

    properties.once('build', (props) => {
      props.should.be.a.Promise();
      props.then((p) => {
        p.hello.should.eql('world');
        done();
      });
    });

    properties.build();
  });

  it('does not reorder source layers if build is called multiple times', function(done) {
    const localProps = new Properties();
    const correctOrder = ['first', 'second'];

    localProps.addStaticLayer({
      hello: 'world'
    }, 'first');
    localProps.addStaticLayer({
      world: 'hello'
    }, 'second');

    let ranOnce = false;

    localProps.on('build', () => {
      const layerKeys = localProps.layers.map((i) => i.namespace);

      layerKeys.should.eql(correctOrder);
      if (ranOnce) {
        layerKeys.should.eql(correctOrder);
        done();
      }
      ranOnce = true;
    });

    localProps.build().then(() => {
      localProps.build();
    });
  });

  it('does not reorder layers if the properties sources getter is called', function() {
    const props = new Properties();

    const sources = [{path: 'foo'}, {path: 'bar'}, {path: 'baz'}].map((prop) => {
      const stub = new Source.Stub();

      stub.properties = prop;

      return stub;
    });

    return props
      .view(sources)
      .activate()
      .then((props) => {
        props.sources[0].properties.path.should.eql('foo');
        props.sources[1].properties.path.should.eql('bar');
        props.sources[2].properties.path.should.eql('baz');
      });
  });

  it('adds layers with namespaces', function() {
    properties.addStaticLayer({
      cruel: 'world'
    }, 'goodbye');

    const expectedPropsResult = {
      goodbye: {
        cruel: 'world'
      },
      hello: 'world'
    };

    return properties.build()
      .then((props) => {
        props.layers.should.have.length(2);
        props._properties.should.eql(expectedPropsResult);
      });
  });

  it('removes properties that have null values', function(done) {
    const properties = new Properties();

    properties.addStaticLayer({
      cruel: 'world',
      leaving: null,
      change: 'my-mind'
    }, 'goodbye');

    const stub = new Source.Stub();

    stub.properties = {
      stubby: null
    };

    properties.addDynamicLayer(stub);

    properties.once('build', (props) => {
      props.then((p) => {
        p.goodbye.cruel.should.eql('world');
        should(p.goodbye.leaving).be.undefined();
        p.goodbye.change.should.eql('my-mind');
        should(p.stubby).be.undefined();
        done();
      });
    });

    properties.build();
  });

  it('doesn\'t override values with properties that have null values', function() {
    const properties = new Properties();
    const stub = new Source.Stub();
    const stub2 = new Source.Stub();

    properties.addStaticLayer({
      cruel: 'world',
      leaving: null,
      change: 'my-mind'
    });

    stub.properties = {
      change: null
    };

    stub2.properties = {
      cruel: null
    };

    properties.addDynamicLayer(stub);
    properties.addDynamicLayer(stub2);

    const expectedLayerResult = {
      cruel: 'world',
      leaving: null,
      change: 'my-mind'
    };

    const expectedPropsResult = {
      cruel: 'world',
      change: 'my-mind'
    };

    return properties.build()
      .then((props) => {
        props.layers.should.have.length(3);
        props.layers[0].properties.should.eql(expectedLayerResult);
        props._properties.should.eql(expectedPropsResult);
      });
  });

  it('merges namespaced layers correctly', function(done) {
    const properties = new Properties();

    properties.addStaticLayer({
      cruel: 'world',
      leaving: null,
      change: 'my-mind'
    }, 'goodbye');

    properties.addStaticLayer({
      foo: 'bar'
    }, 'goodbye');

    properties.once('build', (props) => {
      props.then((p) => {
        p.goodbye.cruel.should.eql('world');
        should(p.goodbye.leaving).be.undefined();
        p.goodbye.change.should.eql('my-mind');
        p.goodbye.foo.should.eql('bar');
        done();
      });
    });

    properties.build();
  });

  it('properly nests namespaces', function(done) {
    const properties = new Properties();
    const stub = new Source.Stub();
    const stub2 = new Source.Stub();

    stub.properties = {
      cruel: 'world',
      leaving: null,
      change: 'my-mind'
    };

    stub2.properties = {
      foo: 'bar',
      baz: 3,
      quiz: true
    };

    properties.addDynamicLayer(stub, 'goodbye:friends');
    properties.addDynamicLayer(stub2, 'this:is:really:deeply:nested');

    properties.once('build', (props) => {
      props.then((p) => {
        p.goodbye.friends.should.be.an.Object();
        p.goodbye.friends.change.should.eql('my-mind');
        p.goodbye.friends.cruel.should.eql('world');

        p.this.is.really.deeply.nested.should.be.an.Object();
        p.this.is.really.deeply.nested.foo.should.eql('bar');
        p.this.is.really.deeply.nested.baz.should.eql(3);
        p.this.is.really.deeply.nested.quiz.should.be.true();
        done();
      });
    });

    properties.build();
  });

  it('properly nests namespaces for multiple layers', function(done) {
    const properties = new Properties();
    const stub = new Source.Stub();
    const stub2 = new Source.Stub();

    stub.properties = {
      cruel: 'world',
      leaving: null,
      change: 'my-mind'
    };

    stub2.properties = {
      foo: 'bar',
      baz: 3
    };

    properties.addDynamicLayer(stub, 'goodbye');
    properties.addDynamicLayer(stub2, 'goodbye:friends');

    properties.once('build', (props) => {
      props.then((p) => {
        p.goodbye.change.should.eql('my-mind');
        p.goodbye.cruel.should.eql('world');
        p.goodbye.friends.should.be.an.Object();
        p.goodbye.friends.baz.should.eql(3);
        p.goodbye.friends.foo.should.eql('bar');
        done();
      });
    });

    properties.build();
  });

  it('adds a dynamic layer and rebuilds on updates', function() {
    const stub = new Source.Stub();

    stub.properties = {
      stubby: 'property!'
    };

    properties.addDynamicLayer(stub);

    const expectedPropsResult = {
      goodbye: {
        cruel: 'world'
      },
      hello: 'world',
      stubby: 'property!'
    };

    return properties.initialize()
      .then((props) => {
        props.layers.should.have.length(3);
        props._properties.should.eql(expectedPropsResult);
      });
  });

  it('creates and activates a new view', function(done) {
    const view = properties.view();

    view.should.be.a.instanceof(View);
    view.parent.should.eql(properties);

    properties.active.should.not.equal(view);
    properties.once('build', () => {
      properties.active.should.eql(view);
      done();
    });

    view.activate();
  });

  it('does nothing when activate is called on the active view', function() {
    properties.active.activate().should.be.a.Promise();
  });

  it('rebuilds properties when a source in the active view updates', function(done) {
    const view = properties.view();
    const stub = new Source.Stub();

    stub.properties = {
      foo: 'bar'
    };

    view.register(stub);

    view.activate().then(() => {
      properties.once('build', (props) => {
        props.then((p) => {
          p.hello.should.eql('world');
          p.goodbye.cruel.should.eql('world');
          p.stubby.should.eql('property!');
          p.foo.should.eql('bar');

          done();
        });
      });

      stub.emit('update');
    });
  });

  it('activates a view correctly when a source is NO_EXIST', function(done) {
    // Get current active view's sources
    const sources = properties.active.sources.concat([]);
    const stub = new Source.NoExistStub();

    // Register sources with new view
    sources.push(stub);
    const view = properties.view(sources);

    properties.once('build', (props) => {
      props.then((p) => {
        stub.state.should.eql(Source.WAITING);

        p.hello.should.eql('world');
        p.goodbye.cruel.should.eql('world');
        p.stubby.should.eql('property!');
        p.foo.should.eql('bar');

        done();
      });
    });

    view.activate();
  });

  it('only rebuilds once for multiple update events', function __(done) {
    // Get current active view's sources
    const sources = properties.active.sources;

    sources[0].properties = {
      first: {
        test: 'value'
      }
    };

    sources[1].properties = {
      second: {
        another: 'value'
      }
    };

    properties.once('build', (props) => {
      props.then((p) => {
        p.hello.should.eql('world');
        p.goodbye.cruel.should.eql('world');
        p.stubby.should.eql('property!');

        // This specifically tests the hold-down behavior. If it didn't work,
        // the first sources indexNumber (0) will be set on the first 'build'
        // event instead
        p.indexNumber.should.eql(1);
        done();
      });
    });

    sources.forEach((source, i) => {
      source.properties = {
        indexNumber: i
      };

      source.emit('update');
    });
  });

  it('does not update properties from sources in an inactive view', function __(done) {
    const props = new Properties();

    // Stub the build method to ensure that it fails within the test context
    function build() {
      throw Error('A build should not have been triggered!');
    }

    const view = props.view();
    const stub = new Source.NoExistStub();

    view.register(stub);

    // A new, unactivated view
    const view2 = props.view();
    const stub2 = new Source.Stub();

    view2.register(stub2);

    view.activate().then(() => {
      props.build = build;

      // This should not trigger a build
      stub2.emit('update');
      delete props.build;

      // Replacing `view` with `view2` should deregister `view`'s sources
      return view2.activate().then(() => {
        props.build = build;

        stub.emit('update');
        done();
      });
    }).catch(done);
  });
});


describe('Merge', function() {
  it('merges one object into another', function() {
    const a = {};
    const b = {
      a: 1, b: 2, c: {
        a: [],
        b: new Date(0)
      }
    };

    const c = merge(a, b);

    a.should.eql(c);
    c.should.eql(b);
  });

  it('merges objects recursively', function() {
    const a = {
      a: 2, c: {
        d: 42
      },
      e: []
    };
    const b = {
      a: 1, b: 2, c: {
        a: [],
        b: new Date(0)
      }
    };

    const c = merge(a, b);

    a.should.eql(c);
    c.should.eql({
      a: 1, b: 2, c: {
        a: [],
        b: new Date(0),
        d: 42
      },
      e: []
    });
  });

  it('instantiates a new object for destination when null or undefined are passed', function() {
    const a = null;
    const b = {a: 1};

    const c = merge(a, b);

    c.should.not.eql(a);
    c.should.eql(b);
  });

  it('avoids merging source when null or undefined are passed', function() {
    const a = {a: 1};
    const b = null;

    const c = merge(a, b);

    c.should.eql(a);
  });

  it('avoids merging keys with null or undefined values', function() {
    const a = {a: 0};
    const b = {
      z: 1,
      n: null,
      u: undefined
    };

    const c = merge(a, b);

    c.should.eql(a);
    c.should.eql({
      a: 0,
      z: 1
    });
  });

  it('always returns an Object', function() {
    const a = [];
    const b = null;

    const c = merge(a, b);

    c.should.not.eql(a);
    c.should.not.eql(b);
    c.should.be.a.Object();
    c.should.be.empty();
  });

  it('does not attempt to merge values that aren\'t direct descendants of Object', function() {
    const a = {
      a: 2, c: {
        a: [1, 2, 3],
        b: {a: 'foo'},
        d: 42,
        e: new Date(1),
        f: []
      },
      e: []
    };
    const b = {
      a: 1, b: 2, c: {
        a: [],
        b: new Date(0),
        e: 'bar',
        f: {a: 123}
      }
    };

    const c = merge(a, b);

    a.should.eql(c);
    c.should.eql({
      a: 1, b: 2, c: {
        a: [],
        b: new Date(0),
        d: 42,
        e: 'bar',
        f: {a: 123}
      },
      e: []
    });
  });
});
