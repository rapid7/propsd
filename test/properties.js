'use strict';

require('./lib/helpers');

const Properties = require('../dist/lib/properties');
const Source = require('./lib/stub/source');

// Shorten build hold-down timeout for testing
Properties.BUILD_HOLD_DOWN = 100;

const expect = require('chai').expect;

describe('Properties', function() {
  const properties = new Properties();

  it('adds static properties and builds', function(done) {
    properties.static({
      hello: 'world'
    });

    expect(properties.layers.length).to.equal(1);

    properties.once('build', (props) => {
      expect(props).to.be.instanceOf(Object);
      expect(props.hello).to.equal('world');

      done();
    });

    properties.build();
  });

  it('does not reorder source layers if build is called multiple times', function(done) {
    const localProps = new Properties();
    const correctOrder = ['first', 'second'];

    localProps.static({
      hello: 'world'
    }, 'first');
    localProps.static({
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

  it('does not reorder layers if the properties sources getter is called', function(done) {
    const props = new Properties();

    const sources = [{path: 'foo'}, {path: 'bar'}, {path: 'baz'}].map((prop) => {
      const stub = new Source.Stub();

      stub.properties = prop;

      return stub;
    });

    const view = props.view(sources);
    const expected = ['foo', 'bar', 'baz'];
    const reversed = ['baz', 'bar', 'foo'];

    props.once('build', () => {
      expect(props.sources.map((s) => s.properties.path)).to.eql(reversed);
      expect(props.active.sources.map((s) => s.properties.path)).to.eql(expected);
      done();
    });

    view.activate();
  });

  it('adds layers with namespaces', function(done) {
    properties.static({
      cruel: 'world'
    }, 'goodbye');

    properties.once('build', (props) => {
      expect(props.hello).to.equal('world');
      expect(props.goodbye.cruel).to.equal('world');
      done();
    });

    properties.build();
  });

  it('removes properties that have null values', function(done) {
    const properties = new Properties();

    properties.static({
      cruel: 'world',
      leaving: null,
      change: 'my-mind'
    }, 'goodbye');

    const stub = new Source.Stub();

    stub.properties = {
      stubby: null
    };

    properties.dynamic(stub);

    properties.once('build', (props) => {
      expect(props.goodbye.cruel).to.equal('world');
      expect(props.goodbye.leaving).to.be.an('undefined');
      expect(props.goodbye.change).to.equal('my-mind');
      expect(props.stubby).to.be.an('undefined');
      done();
    });

    properties.build();
  });

  it('doesn\'t override values with properties that have null values', function(done) {
    const properties = new Properties();
    const stub = new Source.Stub();
    const stub2 = new Source.Stub();

    properties.static({
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

    properties.dynamic(stub);
    properties.dynamic(stub2);

    properties.once('build', (props) => {
      expect(props.cruel).to.equal('world');
      expect(props.leaving).to.be.an('undefined');
      expect(props.change).to.equal('my-mind');
      done();
    });

    properties.build();
  });

  it('merges namespaced layers correctly', function(done) {
    const properties = new Properties();

    properties.static({
      cruel: 'world',
      leaving: null,
      change: 'my-mind'
    }, 'goodbye');

    properties.static({
      foo: 'bar'
    }, 'goodbye');

    properties.once('build', (props) => {
      expect(props.goodbye.cruel).to.equal('world');
      expect(props.goodbye.leaving).to.be.an('undefined');
      expect(props.goodbye.change).to.equal('my-mind');
      expect(props.goodbye.foo).to.equal('bar');
      done();
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

    properties.dynamic(stub, 'goodbye:friends');
    properties.dynamic(stub2, 'this:is:really:deeply:nested');

    properties.once('build', (props) => {
      expect(props.goodbye.friends).to.be.instanceOf(Object);
      expect(props.goodbye.friends.change).to.equal('my-mind');
      expect(props.goodbye.friends.cruel).to.equal('world');

      expect(props.this.is.really.deeply.nested).to.be.instanceOf(Object);
      expect(props.this.is.really.deeply.nested.foo).to.equal('bar');
      expect(props.this.is.really.deeply.nested.baz).to.equal(3);
      expect(props.this.is.really.deeply.nested.quiz).to.be.true;
      done();
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

    properties.dynamic(stub, 'goodbye');
    properties.dynamic(stub2, 'goodbye:friends');

    properties.once('build', (props) => {
      expect(props.goodbye.change).to.equal('my-mind');
      expect(props.goodbye.cruel).to.equal('world');
      expect(props.goodbye.friends).to.be.instanceOf(Object);
      expect(props.goodbye.friends.baz).to.equal(3);
      expect(props.goodbye.friends.foo).to.equal('bar');
      done();
    });

    properties.build();
  });

  it('adds a dynamic layer and rebuilds on updates', function(done) {
    const stub = new Source.Stub();

    stub.properties = {
      stubby: 'property!'
    };

    properties.dynamic(stub);

    properties.initialize().then(() => {
      properties.once('build', (props) => {
        expect(props.hello).to.equal('world');
        expect(props.goodbye.cruel).to.equal('world');
        expect(props.stubby).to.equal('property!');
        done();
      });

      stub.emit('update');
    });
  });

  it('creates and activates a new view', function(done) {
    const view = properties.view();

    expect(view).to.be.instanceOf(Properties.View);
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
        expect(props.hello).to.equal('world');
        expect(props.goodbye.cruel).to.equal('world');
        expect(props.stubby).to.equal('property!');
        expect(props.foo).to.equal('bar');

        done();
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
      expect(stub.state).to.equal(Source.WAITING);

      expect(props.hello).to.equal('world');
      expect(props.goodbye.cruel).to.equal('world');
      expect(props.stubby).to.equal('property!');
      expect(props.foo).to.equal('bar');

      done();
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
      expect(props.hello).to.equal('world');
      expect(props.goodbye.cruel).to.equal('world');
      expect(props.stubby).to.equal('property!');

      // This specifically tests the hold-down behavior. If it didn't work,
      // the first sources indexNumber (0) will be set on the first 'build'
      // event instead
      expect(props.indexNumber).to.equal(1);
      done();
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

    const c = Properties.merge(a, b);

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

    const c = Properties.merge(a, b);

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

    const c = Properties.merge(a, b);

    expect(c).to.not.equal(a);
    expect(c).to.not.equal(b);
    expect(c).to.deep.equal({a: 1});
  });

  it('avoids merging source when null or undefined are passed', function() {
    const a = {a: 1};
    const b = null;

    const c = Properties.merge(a, b);

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

    const c = Properties.merge(a, b);

    expect(c).to.equal(a);
    expect(c).to.deep.equal({
      a: 0,
      z: 1
    });
  });

  it('always returns an Object', function() {
    const a = [];
    const b = null;

    const c = Properties.merge(a, b);

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

    const c = Properties.merge(a, b);

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
