/* global Log */
'use strict';
const Crypto = require('crypto');
const StringTemplate = require('../string-template');

/**
 * Manage a version of the dynamic source index
 */
class Index {
  /**
   * Instantiate Index
   *
   * @param  {Array} configs     Array of configuration parameter objects for sources
   * @param  {Object} properties Lookup for interpolated values in configuration objects
   */
  constructor(configs, properties) {
    this.configurations = {};
    this.sources = {};
    this.order = [];

    // Store the order that source configurations were defined in
    configs.forEach((config) => {
      if (!config.hasOwnProperty('type') || !config.type) {
        Log.log('WARN', 'Source configuration does not have a `type` parameter! Ignoring.');
        return;
      }

      // If the config object doesn't have a name, generate one... Begrudgingly.
      if (!config.hasOwnProperty('name') || !config.name) {
        config.name = config.type + ':' + // eslint-disable-line no-param-reassign
          Crypto.randomBytes(8).toString('hex'); // eslint-disable-line rapid7/static-magic-numbers

        Log.log('WARN', `Source configuration does not have a \`name\` parameter! Generated ${config.name}`);
      }

      // Hash configuration objects by name, and store original order
      this.configurations[config.name] =

        // If a properties object was provided, pass config through StringTemplate
        properties instanceof Object ? StringTemplate.render(config, properties) : config;

      this.order.push(config.name);
    });
  }

  /**
   * Return an ordered set of the Source instances for this index
   *
   * @return {Array}
   */
  ordered() {
    return this.order.filter((name) => this.sources.hasOwnProperty(name) && !!this.sources[name])
      .map((name) => this.sources[name]);
  }
}
module.exports = Index;
