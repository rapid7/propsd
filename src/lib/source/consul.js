'use strict';

/* global Log, Config */
const Client = require('consul');
const Source = require('./common');
const Parser = require('./consul/parser');
const each = require('./metadata/util').each;

/**
 * Consul Source
 *
 * Expose Consul catalog to the property-set
 *
 * @class Source.Consul
 * @extends Source.Polling
 *
 * @param {Parser} parser
 */
class Consul extends Source.Polling(Parser) { // eslint-disable-line new-cap
  /**
   * Constructor
   * @param {String} name  Source instance name
   * @param {Object} opts  Options that can be set for the plugin
   */
  constructor(name, opts) {
    const options = Object.assign({
      host: Config.get('consul:host'),
      port: Config.get('consul:port'),
      secure: Config.get('consul:secure')
    }, opts);

    super(name, options);

    this.client = Client({ // eslint-disable-line new-cap
      host: options.host,
      port: options.port,
      secure: !!options.secure
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
      stale: true
    }, (err, result) => {
      if (err) {
        return callback(err);
      }

      const properties = {};

      const work = (name, next) => {
        this.client.health.service({
          service: name,
          passing: true,
          consistent: false,
          stale: true
        }, (error, data) => {
          if (error) {
            return next(error);
          }

          properties[name] = data;
          next();
        });
      };

      const done = (error) => {
        callback(error, properties);
      };

      each(Object.keys(result), work, done);
    });
  }
}

module.exports = Consul;
