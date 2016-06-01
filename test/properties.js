/* eslint-env mocha */
/* eslint-disable rapid7/static-magic-numbers */
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
  constructor(opts, properties) {
    // Inject defaults into options
    const options = Object.assign({
      type: 'stub',
      delay: 250 + Math.floor(Math.random() * 250),
      nopoll: true
    }, opts);

    super(options);
    this.delay = options.delay;
    this.nopoll = options.nopoll;
    this.properties = properties || {};
  }

  initialize() {
    super.initialize();

    // Kill the polling interval.
    if (this.nopoll) clearTimeout(this._timer);
  }

  _fetch(callback) {
    // Simulate a network request
    setTimeout(() => {
      callback(null, this.properties);
    }, this.delay);
  }
}

class NoStub extends Stub {
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
    const stub = new Stub({}, {
      stubby: 'property!'
    });

    properties.dynamic(stub);

    properties.once('build', (props) => {
      expect(props.hello).to.equal('world');
      expect(props.goodbye.cruel).to.equal('world');
      expect(props.stubby).to.equal('property!');
      done();
    });

    stub.emit('update');
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
      interval: 500
    }, {
      foo: 'bar'
    })

    view.register(stub);

    properties.once('build', (props) => {
      expect(props.hello).to.equal('world');
      expect(props.goodbye.cruel).to.equal('world');
      expect(props.stubby).to.equal('property!');
      expect(props.foo).to.equal('bar');

      done();
    });

    view.activate();
  });

  it('activates a view correctly when a source is NO_EXIST', function __(done) {
    const view = properties.view();
    const stub = new NoStub();

    // Get current active view's sources
    const sources = properties.active.sources;

    // Register sources with new view
    sources.push(stub);
    sources.forEach((source) => view.register(source));

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

      expect(props.first).to.eql({
        test: 'value'
      });

      expect(props.second).to.eql({
        another: 'value'
      });

      done();
    });

    sources.forEach((source) => source.emit('update'));
  });

  it('does not update properties from sources in an inactive view', function __() {
    const stub = new Stub();

    properties.view().register(stub);
    properties.once('build', () => {
      throw Error('It shouldn\'t have done this...');
    });

    stub.emit('update');
  });
});
