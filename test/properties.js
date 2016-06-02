/* eslint-env mocha */
/* eslint-disable rapid7/static-magic-numbers, max-nested-callbacks */
'use strict';

global.Log = new (require('winston').Logger)();

const Properties = require('../lib/properties');
const Source = require('../lib/source/common');

// Shorten build hold-down timeout for testing
Properties.BUILD_HOLD_DOWN = 100;

const expect = require('chai').expect;

class Parser {
  constructor() {
    this.properties = {};
  }

  update(data) {
    this.properties = data;
  }
}

class Stub extends Source(Parser) { // eslint-disable-line new-cap
  constructor(properties, opts) {
    // Inject defaults into options
    const options = Object.assign({
      type: 'stub',
      delay: 250 + Math.floor(Math.random() * 250),
      nopoll: true
    }, opts);

    super('stub', options);
    this.delay = options.delay;
    this.nopoll = options.nopoll;
    this.properties = properties || {};
  }

  initialize() {
    const initialized = super.initialize();

    // Kill the polling interval.
    if (this.nopoll) clearTimeout(this._timer);
    return initialized;
  }

  _fetch(callback) {
    // Simulate a network request
    setTimeout(() => {
      callback(null, this.properties);
    }, this.delay);
  }
}

class NoExistStub extends Stub {
  constructor() {
    super('noexist-stub');
  }

  _fetch(callback) {
    callback(null, Source.NO_EXIST);
  }
}

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
    const stub = new Stub({
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

  it('rebuilds properties when a source in the active view updates', function __(done) {
    const view = properties.view();
    const stub = new Stub({
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
    const stub = new NoExistStub();

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
    const stub = new NoExistStub();

    view.register(stub);

    // A new, unactivated view
    const view2 = props.view();
    const stub2 = new Stub();

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
