/* global Log, Config */
'use strict';

const EventEmitter = require('events').EventEmitter;
const consul = require('consul');
const deepDiff = require('deep-diff').diff;

const DEFAULT_AGENT_ADDRESS = '127.0.0.1';
const DEFAULT_AGENT_PORT = 8500;

class ConquesoCompatHealthParser {
  constructor() {
    this.properties = {};
  }

  /**
   * Parse data from the Consul health watcher
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
   * @param {Array} data
   * @param {String} cluster
   */
  update(data, cluster) {
    const properties = {};
    const addresses = [];

    data.forEach((info) => {
      // Prefer the service address, not the Consul agent address.
      if (info.Service && info.Service.Address) {
        addresses.push(info.Service.Address);
      } else if (info.Node && info.Node.Address) {
        addresses.push(info.Node.Address);
      }
    });

    properties.addresses = addresses.sort();
    properties.cluster = cluster;

    this.properties = properties;
  }
}

class ConquesoCompatServiceParser {
  constructor() {
    this.properties = {};
  }

  /**
   * Parse data from the Consul service list watcher
   *
   * The data returned from Consul looks like this:
   * {
   *   "service-name": ['tag', 'tag'],
   *   "other-service-name": ['other-tag', 'other-tag'],
   * }
   *
   * @param {Object} data
   * @param {Function} filterCallback Optional function to filter health watchers before they're created
   */
  update(data, filterCallback) {
    const services = Object.keys(data);
    let watcherInfo = [];

    services.forEach((service) => {
      watcherInfo.push({
        name: service,
        cluster: service,
        options: {
          passing: true,
          service
        }
      });
    });

    if (filterCallback && filterCallback instanceof Function) {
      watcherInfo = watcherInfo.filter(filterCallback);
    }
    this.properties.watcherInfo = watcherInfo;
  }
}

class Consul extends EventEmitter {
  /**
   * Creates a new instance of a Consul source plugin
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
    this._serviceParser = new ConquesoCompatServiceParser();
  }

  /**
   * Start watching the Consul agent for changes
   */
  initialize() {
    if (this._consul) {
      return;
    }

    this.emit('init');

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
  }

  /**
   * Stop watching the Consul agent for changes
   */
  shutdown() {
    this._shutdownHealthWatchers();
    this._shutdownServiceWatcher();
    delete this._consul;

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
    this._serviceParser.update(data, (info) => !this._hasHealthWatcher(info.name));
    this._serviceParser.properties.watcherInfo.forEach((info) => {
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
   * @param {String} name     The name of the watcher
   * @param {String} cluster  The name of the clustered service
   * @param {Array} data      The JSON data from the health/service API
   * @private
   */
  _onHealthServiceChange(name, cluster, data) {
    if (data.length > 0) {
      this._healthWatchers[name].parser.update(data, cluster);

      if (!this.properties.consul[name]) {
        this.properties.consul[name] = {};
      }

      // Logging to determine the extent of the update
      const diff = deepDiff(this.properties.consul[name], this._healthWatchers[name].parser.properties);

      if (diff) {
        Log.log('SILLY', `Calculated ${this.name} properties diff during update`, {sourceName: 'diff', diff});
      }

      this.properties.consul[name] = this._healthWatchers[name].parser.properties;
    } else {
      // Empty data means the service has been deregistered.
      this._unregisterHealthWatcher(name);
      delete this.properties.consul[name];
    }

    this._okay = true;
    this._updated = new Date();

    this.emit('update', this, {
      serviceName: name,
      clusterName: cluster
    });
  }

  /**
   * Checks if there's already a watcher for the Consul health/service API
   *
   * @param {String}    name The name of the watcher to check
   * @return {Boolean}  true if there's a watcher with the name; false otherwise
   * @private
   */
  _hasHealthWatcher(name) {
    return this._healthWatchers && this._healthWatchers[name] && this._healthWatchers[name].watcher;
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
    this._healthWatchers[name] = {
      watcher,
      parser: new ConquesoCompatHealthParser()
    };
  }

  /**
   * Unregister a watcher that's tracking a Consul health/service API
   * @param {String} name  The name of the watcher
   * @private
   */
  _unregisterHealthWatcher(name) {
    if (this._hasHealthWatcher(name)) {
      this._healthWatchers[name].watcher.end();
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
   * @param {Error} err
   * @private
   */
  _error(err) {
    this._okay = false;

    if (this.listeners('error').length > 0) {
      this.emit('error', err);
    } else {
      Log.log('ERROR', err, {
        sourceName: this.name,
        sourceType: this.type
      });
    }
  }
}

module.exports = Consul;
