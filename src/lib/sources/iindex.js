'use strict';

const Crypto = require('crypto');
const StringTemplate = require('../string-template');

/**
 * Manage a version of the dynamic source index
 */
class Index {
  /**
   * Constructor
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
        config.name = `${config.type}:${Crypto.randomBytes(8).toString('hex')}`;
        Log.log('WARN', `Source configuration does not have a \`name\` parameter! Generated ${config.name}`);
      }

      // Hash configuration objects by name, and store original order
      if (properties instanceof Object) {
        // If a properties object was provided, pass config through StringTemplate
        try {
          this.configurations[config.name] = StringTemplate.render(config, properties);
        } catch (err) {
          // Ignore configurations that we can't perform string interpolation upon
          Log.log('WARN', `Unable to interpolate variables in configuration for ${config.name}: ${err.message}. Ignoring!`);

          return;
        }
      } else {
        this.configurations[config.name] = config;
      }

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
