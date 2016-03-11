/* global Log, Config */
'use strict';

const EventEmitter = require('events').EventEmitter;
const consul = require('consul');

const DEFAULT_AGENT_ADDRESS = '127.0.0.1';
const DEFAULT_AGENT_PORT = 8500;

class Consul extends EventEmitter {
  /**
   * Creates a new instance of a Consul souce plugin
   * See the Consul#configure method for a list of valid options
   *
   * @param {Object} options  Options that can be set for the plugin
   */
  constructor(options) {
    super();
    this.configure(options);
    this.clear();

    this.type = 'consul';
    this.name = 'consul';
    this._okay = false;
    this._updated = null;
  }

  /**
   * Start watching the Consul agent for changes
   */
  initialize() {
    if (this._consul) {
      return;
    }

    Log.info(`Initializing ${this.type} source ${this.name}`, {
      source: this.name,
      type: this.type
    });

    this._consul = consul({
      host: this.host,
      port: this.port,
      secure: this.secure
    });

    this._serviceWatcher = this._consul.watch({
      method: this._consul.catalog.service.list
    });

    this._serviceWatcher.on('error', (error) => {
      this._error(error);
    });

    this._serviceWatcher.on('change', (serviceListData) => {
      this._onServiceListChange(serviceListData);
    });

    this._okay = true;
    this.emit('startup');
  }

  /**
   * Stop watching the Consul agent for changes
   */
  shutdown() {
    this._shutdownHealthWatchers();
    this._shutdownServiceWatcher();
    delete this._consul;

    Log.info(`Shutting down ${this.type} source ${this.name}`, {
      source: this.name,
      type: this.type
    });

    this._okay = false;
    this.emit('shutdown');
  }

  /**
   * Return an object describing the Consul plugin's current status
   *
   * @return {Object}
   */
  status() {
    return {
      ok: this._okay,
      updated: this._updated,
      running: this._running
    };
  }

  /**
   * Configures the Consul plugin
   *
   * The following options are valid:
   * - host (String, default 127.0.0.1): Consul agent's address
   * - port (Number, default 8500) Consul agent's HTTP(S) port
   * - secure (Boolean, default: true): enable HTTPS
   *
   * @param {Object} options  Options that can be set for the plugin
   */
  configure(options) {
    const params = options || {};

    this.host = params.host || DEFAULT_AGENT_ADDRESS;
    this.port = params.port || DEFAULT_AGENT_PORT;
    this.secure = params.secure !== false;
  }

  /**
   * Clear the underlying properties object
   */
  clear() {
    this.properties = {};
    this.properties.consul = {};
  }

  /**
   * Check the status of the Consul watcher
   *
   * @return {Boolean} True if the pooling loop is running
   * @private
   */
  get _running() {
    return !!this._consul;
  }

  /* Process updates from Consul's service/list API.
   *
   * The data returned from Consul looks like this:
   * [
   *   "consul": [],
   *   "service": ["production", "develop"]
   * ]
   *
   * @param {Object} data  The JSON data from the service/list API.
   * @private
   */
  _onServiceListChange(data) {
    const services = Object.keys(data);
    const watcherInfo = [];

    services.forEach((service) => {
      const tags = data[service];

      tags.forEach((tag) => {
        watcherInfo.push({
          name: `${service}-${tag}`,
          cluster: tag,
          options: {
            passing: true,
            service,
            tag
          }
        });
      });

      if (tags.length <= 0) {
        watcherInfo.push({
          name: service,
          cluster: service,
          options: {
            passing: true,
            service
          }
        });
      }
    });

    const newWatchers = watcherInfo.filter((info) => {
      return !this._hasHealthWatcher(info.name);
    });

    newWatchers.forEach((info) => {
      const watcher = this._consul.watch({
        method: this._consul.health.service,
        options: info.options
      });

      watcher.on('error', (error) => {
        this._error(error);
      });

      watcher.on('change', (healthServiceData) => {
        this._onHealthServiceChange(info.name, info.cluster, healthServiceData);
      });

      this._registerHealthWatcher(info.name, watcher);
    });

    this._okay = true;
  }

  /**
   * Process updates from Consul's health/service API.
   *
   * The data returned from Consul looks like this:
   * [{
   *   "Node": {
   *     "Address": "127.0.0.1"
   *   },
   *   "Service": {
   *     "Address": "10.0.0.0"
   *   }
   * }]
   *
   * @param {String} name     The name of the watcher
   * @param {String} cluster  The name of the clustered service
   * @param {Array} data      The JSON data from the health/service API
   * @private
   */
  _onHealthServiceChange(name, cluster, data) {
    if (data.length > 0) {
      const addresses = [];

      data.forEach((info) => {
        // Prefer the service address, not the Consul agent address.
        if (info.Service && info.Service.Address) {
          addresses.push(info.Service.Address);
        } else if (info.Node && info.Node.Address) {
          addresses.push(info.Node.Address);
        }
      });

      if (!this.properties.consul[name]) {
        this.properties.consul[name] = {};
      }
      this.properties.consul[name].addresses = addresses.sort();
      this.properties.consul[name].cluster = cluster;
    } else {
      // Empty data means the service has been deregistered.
      this._unregisterHealthWatcher(name);
      delete this.properties.consul[name];
    }

    this._okay = true;
    this._updated = new Date();

    Log.info(`Updated source ${this.name}`, {
      source: this.name,
      type: this.type,
      name,
      cluster
    });

    this.emit('update', this);
  }

  /**
   * Checks if there's alread a watcher for the Consul health/service API
   *
   * @param {String}    name The name of the watcher to check
   * @return {Boolean}  true if there's a watcher with the name; false otherwise
   * @private
   */
  _hasHealthWatcher(name) {
    return this._healthWatchers && this._healthWatchers[name];
  }

  /**
   * Register a watcher that's tracking a Consul health/service API
   * @param {String} name           The name of the watcher
   * @param {Consul.Watch} watcher  The watcher returned by `consul.watch()`
   * @private
   */
  _registerHealthWatcher(name, watcher) {
    if (!this._healthWatchers) {
      this._healthWatchers = {};
    }
    this._healthWatchers[name] = watcher;
  }

  /**
   * Unregister a watcher that's tracking a Consul health/service API
   * @param {String} name  The name of the watcher
   * @private
   */
  _unregisterHealthWatcher(name) {
    if (this._hasHealthWatcher(name)) {
      this._healthWatchers[name].end();
      delete this._healthWatchers[name];
    }
  }

  /**
   * Shut down everything tracking the Consul health/service API.
   * @private
   */
  _shutdownHealthWatchers() {
    /* eslint-disable guard-for-in */
    // There's already a guard in Consul#_unregisterHealthWatchers
    for (const name in this._healthWatchers) {
      this._unregisterHealthWatcher(name);
    }

    /* eslint-enable guard-for-in */
    delete this._healthWatchers;
  }

  /**
   * Shut down everything tracking the Consul service/list API.
   * @private
   */
  _shutdownServiceWatcher() {
    if (this._serviceWatcher) {
      this._serviceWatcher.end();
    }
    delete this._serviceWatcher;
  }

  /**
   * Generic handler for all errors
   *
   * @param {Error} error
   * @private
   */
  _error(error) {
    this._okay = false;

    Log.error(error, {
      source: this.name,
      type: this.type
    });

    if (this.listeners('error').length > 0) {
      this.emit('error', error);
    }
  }
}

module.exports = Consul;
