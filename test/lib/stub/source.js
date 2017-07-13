'use strict';

const Common = require('../../../dist/lib/source/common');

class Parser {
  constructor() {
    this.properties = {};
    this.sources = [];
  }

  update(data) {
    this.properties = data.properties;
    this.sources = data.sources || [];
  }
}

class Stub extends Common(Parser) {
  constructor(name, opts) {
    // Inject defaults into options
    const options = Object.assign({
      type: 'stub',
      delay: 250 + Math.floor(Math.random() * 250)
    }, opts);

    super('stub', options);
    this.delay = options.delay;
    this.name = name;
    this.properties = {};
  }

  initialize() {
    const initialized = super.initialize();

    // Simulate a network request
    setTimeout(() => {
      this._update({properties: this.properties});
    }, this.delay);

    return initialized;
  }

  update(properties) {
    this._update({properties});
  }

  error(err) {
    this._error(err || new Error('this is a stub error'));
  }

  recover() {
    this._update({properties: this.properties});
  }
}

class NoExistStub extends Stub {
  constructor(properties, options) {
    super(properties, options);
  }

  initialize() {
    const initialized = super.initialize();

    setImmediate(() => this._update(Common.NO_EXIST));

    return initialized;
  }
}

class ErrorStub extends Stub {
  constructor(properties, options) {
    super(properties, options);
  }

  initialize() {
    const initialized = super.initialize();

    setImmediate(() => this._error(new Error('This is a test error')));

    return initialized;
  }

}

class PollingStub extends Common.Polling(Parser) {
  constructor(properties, options) {
    super('polling-stub', options);
    this.properties = properties;
  }

  _fetch(callback) {
    setImmediate(() => callback(null, {properties: this.properties}));
  }
}

class IndexStub extends Common(Parser) {
  constructor(sources) {
    super('index', {});
    this.sources = sources;
  }

  initialize() {
    const initialized = super.initialize();

    setImmediate(() => this._update({sources: this.sources}));

    return initialized;
  }

  update(sources) {
    this._update({sources});
  }

  error(err) {
    this._error(err || new Error('this is a stub error'));
  }

  recover() {
    this._update({sources: this.sources});
  }
}

// Wrap a namespace around the common module. This exposes
// constants and helpers as one would expect, but protects the namespace
// of the cached Common module.
module.exports = class extends Common.Class {};

module.exports.Common = Common;
module.exports.Stub = Stub;
module.exports.NoExistStub = NoExistStub;
module.exports.ErrorStub = ErrorStub;
module.exports.PollingStub = PollingStub;
module.exports.IndexStub = IndexStub;
