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
    callback(null, Common.NO_EXIST);
  }
}

exports.Common = Common;
exports.Stub = Stub;
exports.NoExistStub = NoExistStub;
