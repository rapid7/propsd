/* global Log, Config */
'use strict';

const EventEmitter = require('events').EventEmitter;
const consul = require('consul');

const DEFAULT_AGENT_ADDRESS = '127.0.0.1';

class Consul extends EventEmitter {
  /**
   * Creates a new instance of a Consul souce plugin
   *
   * The following options are valid:
   * - host: The address of the Consul agent to connect to
   *
   * @param {Object} options  Options that can be set for the plugin
   */
  constructor(options) {
    super();

    const configuration = options || Object.create(null);

    this.type = 'consul';
    this.properties = Object.create(null);
    this.host = configuration.host || DEFAULT_AGENT_ADDRESS;
  }

  initialize() {
    if (this._consul) {
      return this;
    }

    this._consul = consul({
      host: this.host
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

    this.emit('startup');
    return this;
  }

  shutdown() {
    this._shutdownHealthWatchers();
    this._shutdownServiceWatcher();
    delete this._consul;

    this.emit('shutdown');
    return this;
  }

  /**
   * Return an object describing the Consul plugin's current status
   *
   * @return {Object}
   */
  status() {
    return {
      running: this._running
    };
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

  /**
   * Returns the name of the plugin
   * @return {String}
   */
  get name() {
    return 'consul';
  }

  /* Process updates from Consul's service/list API.
   *
   * The data returned Consul looks like this:
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

      if (tags.length > 0) {
        tags.forEach((tag) => {
          watcherInfo.push({
            name: service + '-' + tag,
            options: {
              passing: true,
              service,
              tag
            }
          });
        });
      } else {
        watcherInfo.push({
          name: service,
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
        this._onHealthServiceChange(info.name, healthServiceData);
      });

      this._registerHealthWatcher(info.name, watcher);
    });
  }

  /**
   * Process updates from Consul's health/service API.
   *
   * The data returned from Consul has the following format:
   * [{
   *   "Node": {
   *     "Address": "127.0.0.1"
   *   },
   *   "Service": {
   *     "Address": ""
   *   }
   * }]
   *
   * The Service.Address attribute is provided may or may not be given.
   * If it's provided, it's the address defined by the service. The
   * Node.Address attribute is the address provided by Consul.
   *
   * @param {String} name  The name of the watcher
   * @param {Object} data  The JSON data from the health/service API
   * @private
   */
  _onHealthServiceChange(name, data) {
    if (data.length > 0) {
      const addresses = [];

      for (let i = 0; i < data.length; i += 1) {
        const info = data[i];

        if (info.Service && info.Service.Address) {
          addresses.push(info.Service.Address);
        } else if (info.Node && info.Node.Address) {
          addresses.push(info.Node.Address);
        }
      }

      if (!this.properties[name]) {
        this.properties[name] = Object.create(null);
      }
      this.properties[name].addresses = addresses.sort();
    } else {
      // Empty data means the service has been deregistered.
      this._unregisterHealthWatcher(name);
      delete this.properties[name];
    }

    this.emit('update', this.properties);
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
      this._healthWatchers = Object.create(null);
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
    for (const name in this._healthWatchers) {
      if (this._healthWatchers[name]) {
        this._unregisterHealthWatcher(name);
      }
    }
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
   * @return {Consul}
   * @private
   */
  _error(error) {
    Log.error(error, {
      source: this.name,
      type: this.type
    });

    if (this.listeners('error').length > 0) {
      this.emit('error', error);
    }

    return this;
  }
}

module.exports = Consul;
