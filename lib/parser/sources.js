'use strict';

const Source = require('../source');
const Parser = require('./index');

/**
 * Parse an Index document and instantiate Sources
 * https://github.com/rapid7/propsd/blob/master/docs/schemas.md#10-schema
 *
 * @class Sources
 * @extends Parser
 */
class Sources extends Parser {
  constructor(source, options) {
    super(source, options);

    this.sources = [];
    this._sources = {};
  }

  /**
   * Parse the raw response from a parent Source instance
   *
   * @param  {Buffer} data Raw response from Source
   * @return {Void}
   */
  update(data) {
    const _this = this;
    const document = JSON.parse(data.toString('utf8'));

    Log.info('Updating source configurations');

    // TODO Validation
    if (document.hasOwnProperty('sources')) {
      if (!(document.sources instanceof Array)) return Log.warn('document.sources is not an array!');

      this.updateSources(document.sources);
    }
  }

  /**
   * Handle initialization, re-configuration, and shutdown of source instances
   *
   * @param  {Array} update An ordered set of source-configurations to apply
   */
  updateSources(update) {
    const _this = this;
    const _sources = {};
    const sources = [];

    // Hash running Source instances by name for removal
    const removedSources = {};
    this.sources.forEach(function (source) {
      removedSources[source.name] = source;
    });

    update.forEach(function (config) {
      let source;

      // Ignore source definitions with unsupported types
      if (!Source.handlers.hasOwnProperty(config.type))
        return Log.warn('Source ' + config.name + ' does not have a supported type: ' + config.type);

      // Don't shutdown this source later...
      delete removedSources[config.name];

      // All sources have a name parameter
      const parameters = config.parameters || {};
      parameters.name = config.name;

      // Initialize a new Source instance
      if (!_this._sources.hasOwnProperty(config.name)) {
        const Type = Source.handlers[config.type];

        // Some codelines can pass a source-specific parser class
        const InstanceParser = config.parser || Parser.Properties;
        if (!(InstanceParser.prototype instanceof Parser))
          return Log.warn('Source ' + config.name + ' does not have a valid Parser.');

        source = new Type(InstanceParser, parameters).initialize();
        _this.source.emit('source', source);
      } else {
        // Update an existing source
        source = _this._sources[source.name];

        if (source.configure(parameters)) Log.info('Updated ' + source.name + '\'s configuration');
      }

      // Construct a new set of sources
      sources.push(source);
      _sources[source.name] = source;
    });

    this.sources = sources;
    this._sources = _sources;

    // Shutdown removed sources
    Object.keys(removedSources).forEach(function (name) {
      removedSources[name].shutdown();
    });
  }

}

/* Export */
module.exports = Sources;
