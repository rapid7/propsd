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
  constructor() {
    super('noexist-stub');
  }

  initialize() {
    const initialized = super.initialize();

    setImmediate(() => this._update(Common.NO_EXIST));
    return initialized;
  }
}

class ErrorStub extends Stub {
  constructor() {
    super('noexist-stub');
  }

  initialize() {
    const initialized = super.initialize();

    setImmediate(() => this._error(new Error('This is a test error')));
    return initialized;
  }

}

module.exports = Common;
Common.Stub = Stub;
Common.NoExistStub = NoExistStub;
Common.ErrorStub = ErrorStub;
