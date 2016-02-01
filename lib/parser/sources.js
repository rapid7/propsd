var Parser = require('./index');
var Storage = require('../storage');

/**
 * Parse an Index document and instantiate Sources
 * https://github.com/rapid7/propsd/blob/master/docs/schemas.md#10-schema
 *
 * @class Sources
 * @extends Parser
 */
var Sources = module.exports = function(options) {
  Parser.call(this, options);

  this.sources = [];
  this._sources = {};
};

Parser.extends(Sources);

// Ensure that Parser.Sources in exported when Source implementations are loaded
Parser.Sources = Sources;
var Source = require('../source');

/**
 * Parse the raw response from a parent Source instance
 *
 * @param  {Buffer} data Raw response from Source
 * @return {Void}
 */
Sources.prototype.update = function(data) {
  Log.info('Updating source configurations');
  var _this = this;


  var document = JSON.parse(data.toString('utf8'));

  // TODO Validation
  if (document.hasOwnProperty('sources')) {
    if (!(document.sources instanceof Array)) return Log.warn('document.sources is not an array!');

    this.updateSources(document.sources);
  }
};

/**
 * Handle initialization, re-configuration, and shutdown of source instances
 *
 * @param  {Array} update An ordered set of source-configurations to apply
 * @return {Void}
 */
Sources.prototype.updateSources = function(update) {
  var _this = this;
  var _sources = {};
  var sources = [];

  // Hash running Source instances by name for removal
  var removedSources = {};
  this.sources.forEach(function(source) {
    removedSources[source.name] = source;
  });

  update.forEach(function(source) {
    // Ignore source definitions with unsupported types
    if (!Source.handlers.hasOwnProperty(source.type))
      return Log.warn('Source ' + source.name + ' does not have a supported type: ' + source.type);

    // Don't shutdown this source later...
    delete removedSources[source.name];

    // All sources have a name parameter
    var parameters = source.parameters || {};
    parameters.name = source.name;

    // Initialize a new Source instance
    if (!_this._sources.hasOwnProperty(source.name)) {
      var Type = Source.handlers[source.type];

      // Some codelines can pass a source-specific parser class
      var InstanceParser = source.parser || Parser.Properties;

      // Is InstanceParser really a Parser?
      if (!(InstanceParser.prototype instanceof Parser))
        return Log.warn('Source ' + source.name + ' does not have a valid Parser.');

      source = new Type(InstanceParser, parameters, function() {
        // Trigger a recompile of the global properties set
        Storage.update();
      }).initialize();

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
  Object.keys(removedSources).forEach(function(name) {
    removedSources[name].shutdown();
  });
};
