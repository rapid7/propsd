/* eslint-disable no-use-before-define */
const EventEmitter = require('events').EventEmitter;
const Reflect = require('./util/reflect');

const UPDATE_HOLD = 2000;

/**
 * Manage sources and their properties
 *
 * @emits update After updates from a source have been merged
 */
const Storage = module.exports = new EventEmitter();

Storage.properties = {};
Storage.sources = [];
Storage._sources = {};

Storage.source = function (name) {
  return this._sources[name];
};

Storage.initialize = function () {
  this.index = new Source.S3(Parser.Sources, {
    name: 'index',
    bucket: Config.get('index:bucket'),
    path: Config.get('index:path'),
    interval: Config.get('index:interval')
  }, () => this.updateSources());

  this.index.on('source', (source) =>
    source.on('update', () => this.update()));

  // Consul catalog watcher
  this.consul = new Source.Consul(Source.Consul.Catalog, {
    name: 'consul-catalog',
    method: Source.Consul.service.catalog.service.list
  }, () => this.updateSources());

  this.consul.on('source', (source) =>
    source.on('update', () => this.update()));

  // Default Metadata source
  this.metadata = new Source.Metadata({
    interval: Config.get('metadata:interval')
  }, () => this.update());

  // Once metadata is populated, fetch the index.
  this.metadata.initialize(() => {
    this.index.initialize();
    this.consul.initialize();
  });
};

/**
 * Compile sources' properties into a single document
 */
Storage.update = function () {
  if (this._update) return;
  const _this = this;

  // Set a 2s timeout to suppress rapid updates from multiple sources
  this._update = setTimeout(function () {
    const properties = {};
    _this.sources.forEach(function (source) {
      Reflect.merge(source.properties, properties);
    });

    _this.properties = properties;

    _this.emit('update', properties);
    delete _this._update;

    Log.info('Updated storage properties');
  }, UPDATE_HOLD);
};

/**
 * Update the 'sources' property
 */
Storage.updateSources = function () {
  this.sources = [].concat(
    [this.metadata],
    this.index.sources,
    this.consul.sources
  );

  const _sources = {};
  _sources[this.metadata.name] = this.metadata;
  Reflect.merge(this.index._sources, _sources);
  Reflect.merge(this.consul._sources, _sources);

  this._sources = _sources;
};

const Parser = require('./parser');
const Source = require('./source');

/**
 * Load Source and Parser plugins. This should be with functionality to auto-load
 * external plugin modules.
 */
Parser.Properties = require('./parser/properties');
Parser.Sources = require('./parser/sources');

Source.Consul = require('./source/consul');
Source.Metadata = require('./source/metadata');
Source.S3 = require('./source/s3');
