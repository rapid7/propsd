var EventEmitter = require('events').EventEmitter;
var Reflect = require('./util/reflect');

/**
 * Manage sources and their properties
 *
 * @emits update After updates from a source have been merged
 */
var Storage = module.exports = new EventEmitter();

Storage.properties = {};
Storage.sources = [];
Storage._sources = {};

Storage.source = function(name) {
  return this._sources[name];
};

Storage.initialize = function() {
  var _this = this;

  this.index = new Source.S3(Parser.Sources, {
    name: 'index',
    bucket: Config.get('index:bucket'),
    path: Config.get('index:path'),
    interval: Config.get('index:interval')
  }, function() {
    _this.updateSources();
  });

  // Consul catalog watcher
  this.consul = new Source.Consul(Source.Consul.Catalog, {
    name: 'consul-catalog',
    method: Source.Consul.service.catalog.service.list
  }, function() {
    _this.updateSources();
  });

  // Default Metadata source
  this.metadata = new Source.Metadata({
    interval: Config.get('metadata:interval')
  }, function() {
    _this.update();
  });

  // Once metadata is populated, fetch the index.
  this.metadata.initialize(function() {
    _this.index.initialize();
    _this.consul.initialize();
  });
};

/**
 * Compile sources' properties into a single document
 *
 * @return {Object} Compiled properties
 */
Storage.update = function() {
  if (this._update) return;
  var _this = this;

  // Set a 2s timeout to suppress rapid updates from multiple sources
  this._update = setTimeout(function() {

    var properties = {};
    _this.sources.forEach(function(source) {
      Reflect.merge(source.properties, properties);
    });

    _this.properties = properties;

    _this.emit('update', properties);
    delete _this._update;

    Log.info('Updated storage properties');
  }, 2000);
};

Storage.updateSources = function() {
  this.sources = [].concat(
    [this.metadata],
    this.index.sources,
    this.consul.sources
  );

  var _sources = {};
  _sources[this.metadata.name] = this.metadata;
  Reflect.merge(this.index._sources, _sources);
  Reflect.merge(this.consul._sources, _sources);

  this._sources = _sources;
};

var Parser = require('./parser');
var Source = require('./source');
