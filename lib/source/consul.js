'use strict';

/* global Log, Config */
const Client = require('consul');
const Source = require('./common');
const Parser = require('./consul/parser');

class Consul extends Source(Parser) { // eslint-disable-line new-cap
  /**
   * Creates a new instance of a Consul Source
   *
   * @param {String} name  Source instance name
   * @param {Object} opts  Options that can be set for the plugin
   */
  constructor(name, opts) {
    const options = Object.assign({
      host: Consul.DEFAULT_ADDRESS,
      port: Consul.DEFAULT_PORT,
      secure: false
    }, opts);

    super(name, options);

    this.client = Client({ // eslint-disable-line new-cap
      host: options.host,
      port: options.port,
      secure: !!options.secure
    });
  }

  /**
   * Start watching the Consul agent for changes
   *
   * @returns {Promise<Consul>}
   */
  initialize() {
    const promise = super.initialize();

    if (this.watcher) { return promise; }

    this.watcher = this.client.watch({
      method: this.client.health.state,
      options: {state: 'any'}
    });

    this.watcher.on('error', (error) => {
      this._error(error);
    });

    this.watcher.on('change', (checks) => {
      this._update(checks);
    });

    return promise;
  }

  /**
   * Stop watching the Consul agent for changes
   *
   * @returns {Consul}
   */
  shutdown() {
    super.shutdown();

    if (this.watcher) {
      this.watcher.end();
      delete this.watcher;
    }

    return this;
  }

  /**
   * Update the catalog cache before parsing results
   *
   * @param  {Object} data Payload from watcher event
   */
  _update(data) {
    this.client.catalog.node.list((err, nodes) => {
      if (err) { return this._error(err); }

      this.parser.catalog(nodes);
      super._update(data);
    });
  }

  /**
   * Get a list services from the Consul catalog.
   *
   * @param {Function} callback  Function to call when finished
   * @private
   */
  _fetch(callback) {
    this.client.catalog.service.list({
      consistent: false,
      state: true
    }, (err, result) => {
      if (err) {
        return callback(err);
      }

      callback(null, Object.keys(result).sort());
    });
  }
}

Consul.DEFAULT_ADDRESS = '127.0.0.1';
Consul.DEFAULT_PORT = 8500; // eslint-disable-line rapid7/static-magic-numbers

module.exports = Consul;
