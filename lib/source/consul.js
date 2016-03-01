/* global Log, Config */
'use strict';

const EventEmitter = require('events').EventEmitter;
const consul = require('consul');

class Consul extends EventEmitter {
  constructor() {
    super();

    this.properties = Object.create(null);
  }

  initialize() {
    if (this._consul) {
      return this;
    }

    this._consul = consul();

    this._serviceWatcher = this._consul.watch({
      method: this._consul.catalog.service.list
    });

    this._serviceWatcher.on('error', (error) => {
      this._error(error);
    });

    /* Data returned from the service/list API on change looks like this:
     *
     * [
     *   "consul": [],
     *   "service": ["production", "develop"]
     * ]
     */
    this._serviceWatcher.on('change', (serviceListData) => {
      const services = Object.keys(serviceListData);
      const watcherOptions = [];

      this._shutdownHealthWatchers();
      this._healthWatchers = Object.create(null);
      this.properties = Object.create(null);

      services.forEach((service) => {
        const tags = serviceListData[service];

        if (tags.length > 0) {
          tags.forEach((tag) => {
            watcherOptions.push({
              passing: true,
              service,
              tag
            });
          });
        } else {
          watcherOptions.push({
            passing: true,
            service
          });
        }
      });

      watcherOptions.forEach((options) => {
        const watcher = this._consul.watch({
          method: this._consul.health.service,
          options
        });
        let name = options.service;

        if (options.tag) {
          name += '-' + options.tag;
        }

        watcher.on('error', (error) => {
          this._error(error);
        });

        /* Data returned from the health/service API on change looks like this:
         *
         * [{
         *   "Node": {
         *     "Address": "127.0.0.1"
         *   },
         *   "Service": {
         *     "Address": ""
         *   }
         * }]
         *
         * If the Service.Address is defined, used that. Otherwise, fall back to
         * the Node.Address.
         */
        watcher.on('change', (healthServiceData) => {
          const addresses = [];

          for (let i = 0; i < healthServiceData.length; i += 1) {
            const info = healthServiceData[i];

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
          this.emit('update', this.properties);
        });

        this._healthWatchers[name] = watcher;
      });

      this.emit('update', this.properties);
    });

    this.emit('startup');
    return this;
  }

  shutdown() {
    this._shutdownHealthWatchers();
    this._shutdownServiceWatcher();

    if (this._consul) {
      delete this._consul;
    }

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
   * Returns the type of the plugin
   * @return {String}
   */
  get type() {
    return this.constructor.type;
  }

  /**
   * Returns the name of the plugin
   * @return {String}
   */
  get name() {
    return 'consul';
  }

  /**
   * Shut down everything tracking the Consul health/service API.
   * @private
   */
  _shutdownHealthWatchers() {
    if (this._healthWatchers) {
      for (const name in this._healthWatchers) {
        if (this._healthWatchers[name]) {
          this._healthWatchers[name].end();
          delete this._healthWatchers[name];
        }
      }
      delete this._healthWatchers;
    }
  }

  /**
   * Shut down everything tracking the Consul service/list API.
   * @private
   */
  _shutdownServiceWatcher() {
    if (this._serviceWatcher) {
      this._serviceWatcher.end();
      delete this._serviceWatcher;
    }
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

Consul.type = 'consul';

module.exports = Consul;
