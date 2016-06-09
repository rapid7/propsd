'use strict';

/* eslint-env mocha */
/* global Config, Log */
/* eslint-disable max-nested-callbacks, rapid7/static-magic-numbers */

require('./lib/helpers');

const Properties = require('../lib/properties');
const Source = require('./lib/stub/source');

// Shorten build hold-down timeout for testing
Properties.BUILD_HOLD_DOWN = 100;

const expect = require('chai').expect;

describe('Properties', function _() {
  const properties = new Properties();

  it('adds static properties and builds', function __(done) {
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

  it('adds layers with namespaces', function __(done) {
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

  it('adds a dynamic layer and rebuilds on updates', function __(done) {
    const stub = new Source.Stub({
      stubby: 'property!'
    });

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

  it('creates and activates a new view', function __(done) {
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

  it('does nothing when activate is called on the active view', function __() {
    expect(properties.active.activate()).to.be.instanceOf(Promise);
  });

  it('rebuilds properties when a source in the active view updates', function __(done) {
    const view = properties.view();
    const stub = new Source.Stub({
      foo: 'bar'
    });

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

  it('activates a view correctly when a source is NO_EXIST', function __(done) {
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
      source.properties = { // eslint-disable-line no-param-reassign
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

  describe('Merge', function __() {
    it('merges one object into another', function ___() {
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

    it('merges objects recursively', function ___() {
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

    it('instantiates a new object for destination when null or undefined are passed', function ___() {
      const a = null;
      const b = {a: 1};

      const c = Properties.merge(a, b);

      expect(c).to.not.equal(a);
      expect(c).to.not.equal(b);
      expect(c).to.deep.equal({a: 1});
    });

    it('instantiates a new object for source when null or undefined are passed', function ___() {
      const a = {a: 1};
      const b = null;

      const c = Properties.merge(a, b);

      expect(c).to.equal(a);
      expect(c).to.deep.equal({a: 1});
    });

    it('does not attempt to merge values that aren\'t direct descendants of Object', function ___() {
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
});
