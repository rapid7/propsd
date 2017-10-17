'use strict';

require('./lib/helpers');

const Properties = require('../dist/lib/properties');
const View = require('../dist/lib/properties/view');
const Source = require('./lib/stub/source');
const merge = require('../dist/lib/util').merge;

// Shorten build hold-down timeout for testing
Properties.BUILD_HOLD_DOWN = 100;

const expect = require('chai').expect;

describe('Properties', function() {
  const properties = new Properties();

  before(function () {
    nock.disableNetConnect();
  });

  after(function () {
    nock.enableNetConnect();
  });

  it('adds static properties and builds', function(done) {
    properties.addStaticLayer({
      hello: 'world'
    });

    expect(properties.layers.length).to.equal(1);

    properties.once('build', (props) => {
      expect(props).to.be.instanceOf(Promise);
      props.then((p) => {
        expect(p.hello).to.equal('world');
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

      expect(layerKeys).to.eql(correctOrder);
      if (ranOnce) {
        expect(layerKeys).to.eql(correctOrder);
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

    const view = props.view(sources);
    const expected = ['foo', 'bar', 'baz'];
    const reversed = ['baz', 'bar', 'foo'];

    return view.activate()
      .then(function (props) {
        expect(props.sources[0].properties.path).to.eql('foo');
        expect(props.sources[1].properties.path).to.eql('bar');
        expect(props.sources[2].properties.path).to.eql('baz');
      });
  });

  it('adds layers with namespaces', function(done) {
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
      .then(function (props) {
        expect(props.layers).to.have.length(2);
        expect(props._properties).to.eql(expectedPropsResult);
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
        expect(p.goodbye.cruel).to.equal('world');
        expect(p.goodbye.leaving).to.be.an('undefined');
        expect(p.goodbye.change).to.equal('my-mind');
        expect(p.stubby).to.be.an('undefined');
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
      .then(function (props) {
        expect(props.layers).to.have.length(3);
        expect(props.layers[0].properties).to.eql(expectedLayerResult);
        expect(props._properties).to.eql(expectedPropsResult);
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
        expect(p.goodbye.cruel).to.equal('world');
        expect(p.goodbye.leaving).to.be.an('undefined');
        expect(p.goodbye.change).to.equal('my-mind');
        expect(p.goodbye.foo).to.equal('bar');
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
        expect(p.goodbye.friends).to.be.instanceOf(Object);
        expect(p.goodbye.friends.change).to.equal('my-mind');
        expect(p.goodbye.friends.cruel).to.equal('world');

        expect(p.this.is.really.deeply.nested).to.be.instanceOf(Object);
        expect(p.this.is.really.deeply.nested.foo).to.equal('bar');
        expect(p.this.is.really.deeply.nested.baz).to.equal(3);
        expect(p.this.is.really.deeply.nested.quiz).to.be.true;
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
        expect(p.goodbye.change).to.equal('my-mind');
        expect(p.goodbye.cruel).to.equal('world');
        expect(p.goodbye.friends).to.be.instanceOf(Object);
        expect(p.goodbye.friends.baz).to.equal(3);
        expect(p.goodbye.friends.foo).to.equal('bar');
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
      .then(function (props) {
        expect(props.layers).to.be.length(3);
        expect(props._properties).to.eql(expectedPropsResult);
      });
  });

  it('creates and activates a new view', function(done) {
    const view = properties.view();

    expect(view).to.be.instanceOf(View);
    expect(view.parent).to.equal(properties);

    expect(properties.active).to.not.equal(view);
    properties.once('build', () => {
      expect(properties.active).to.equal(view);
      done();
    });

    view.activate();
  });

  it('does nothing when activate is called on the active view', function() {
    expect(properties.active.activate()).to.be.instanceOf(Promise);
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
          expect(p.hello).to.equal('world');
          expect(p.goodbye.cruel).to.equal('world');
          expect(p.stubby).to.equal('property!');
          expect(p.foo).to.equal('bar');

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
        expect(stub.state).to.equal(Source.WAITING);

        expect(p.hello).to.equal('world');
        expect(p.goodbye.cruel).to.equal('world');
        expect(p.stubby).to.equal('property!');
        expect(p.foo).to.equal('bar');

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
        expect(p.hello).to.equal('world');
        expect(p.goodbye.cruel).to.equal('world');
        expect(p.stubby).to.equal('property!');

        // This specifically tests the hold-down behavior. If it didn't work,
        // the first sources indexNumber (0) will be set on the first 'build'
        // event instead
        expect(p.indexNumber).to.equal(1);
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

    expect(a).to.equal(c);
    expect(c).to.deep.equal(b);
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

    expect(a).to.equal(c);
    expect(c).to.deep.equal({
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

    expect(c).to.not.equal(a);
    expect(c).to.not.equal(b);
    expect(c).to.deep.equal({a: 1});
  });

  it('avoids merging source when null or undefined are passed', function() {
    const a = {a: 1};
    const b = null;

    const c = merge(a, b);

    expect(c).to.equal(a);
    expect(c).to.deep.equal({a: 1});
  });

  it('avoids merging keys with null or undefined values', function() {
    const a = {a: 0};
    const b = {
      z: 1,
      n: null,
      u: undefined
    };

    const c = merge(a, b);

    expect(c).to.equal(a);
    expect(c).to.deep.equal({
      a: 0,
      z: 1
    });
  });

  it('always returns an Object', function() {
    const a = [];
    const b = null;

    const c = merge(a, b);

    expect(c).to.not.equal(a);
    expect(c).to.not.equal(b);
    expect(c).to.be.instanceOf(Object);
    expect(c).to.deep.equal({});
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

    expect(a).to.equal(c);
    expect(c).to.deep.equal({
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
