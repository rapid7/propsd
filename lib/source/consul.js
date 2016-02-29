/* global Log, Config */
'use strict';

const EventEmitter = require('events').EventEmitter;
const consul = require('consul');

const DEFAULT_INTERVAL = 60000;

class Consul extends EventEmitter {
  constructor(params) {
    super();

    const options = params || {};

    this.interval = options.interval || DEFAULT_INTERVAL;
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

      this.shutdownHealthWatchers();
      this._healthWatchers = {};

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
         *     "Service": "consul",
         *     "Address": ""
         *   }
         * }]
         */
        watcher.on('change', (healthServiceData) => {
          Log.info('CHANGE %s => %s', name, JSON.stringify(healthServiceData));
        });

        this._healthWatchers[name] = watcher;
      });
    });

    return this;
  }

  shutdown() {
    this.shutdownHealthWatchers();

    if (this._serviceWatcher) {
      this._serviceWatcher.end();
      delete this._serviceWatcher;
    }

    if (this._consul) {
      delete this._consul;
    }

    return this;
  }

  shutdownHealthWatchers() {
    if (this._healthWatchers) {
      for (const name in this._healthWatchers) {
        if (this._healthWatchers.hasOwnProperty(name)) {
          this._healthWatchers[name].end();
          delete this._healthWatchers[name];
        }
      }
      delete this._healthWatchers;
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
