/* global Log, Config */
'use strict';

const EventEmitter = require('events').EventEmitter;

const DEFAULT_INTERVAL = 60000;

class Consul extends EventEmitter {
  constructor(params) {
    super();

    const options = params || {};

    this.interval = options.interval || DEFAULT_INTERVAL;
  }
}

Consul.type = 'consul';

module.exports = Consul;
