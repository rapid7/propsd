'use strict';

/* eslint-disable rapid7/static-magic-numbers */
const Common = require('../../../lib/source/common');

class Parser {
  constructor() {
    this.properties = {};
  }

  update(data) {
    this.properties = data;
  }
}

class Stub extends Common(Parser) { // eslint-disable-line new-cap
  constructor(properties, opts) {
    // Inject defaults into options
    const options = Object.assign({
      type: 'stub',
      delay: 250 + Math.floor(Math.random() * 250)
    }, opts);

    super('stub', options);
    this.delay = options.delay;
    this.properties = properties || {};
  }

  initialize() {
    const initialized = super.initialize();

    // Simulate a network request
    setTimeout(() => {
      this._update(this.properties);
    }, this.delay);

    return initialized;
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
    setImmediate(() => callback(null, this.properties));
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
