/* global Log, Config */
'use strict';

const EventEmitter = require('events').EventEmitter;
const StringTemplate = require('./string-template');
const Metadata = require('./source/metadata');
const S3 = require('./source/s3');

// const Consul = require('./source/consul');
// const File = require('./source/file');

/**
 * Recursively iterate through an object applying the callback to each k/v pair
 * @param {Object} obj
 * @param {Function} callback
 * @returns {Object}
 */
function iter(obj, callback) {
  const collected = {};
  let value;

  for (const prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      if (typeof obj[prop] === 'object') {
        value = iter(obj[prop], callback);
      } else {
        value = callback(prop, obj[prop]);
      }
      collected[prop] = value;
    }
  }
  return collected;
}

class PluginManager extends EventEmitter {
  constructor(storage) {
    super();
    this.storage = storage;
    this.index = new S3({
      interval: Config.get('index:interval'),
      bucket: Config.get('index:bucket'),
      path: Config.get('index:path')
    });
    this.metadata = new Metadata();
  }

  /**
   * Initialize the PluginManager's index and metadata source
   */
  init() {
    Log.info('Initializing index');
    this._buildIndex();

    this.index.on('update', () => {
      this._buildIndex();
    });
  }

  /**
   * Shutdown the plugin manager's sources. Optionally,
   * delete the sources from the storage layer.
   *
   * @param {Boolean} del
   */
  shutdown(del) {
    Log.info('Shutting down sources');
    this.storage.sources.forEach((source) => {
      source.shutdown();
    });

    if (del === true) {
      this.storage.sources = [];
    }
  }

  /**
   * Coordinate fetching the PluginManager's index and metadata source and munging them together
   * @private
   */
  _buildIndex() {
    const indexPromise = new Promise(
        (resolve, reject) => {
          this.index.once('update', () => {
            resolve();
          });
          this.index.once('error', (err) => {
            reject(err);
          });

          this.index.initialize();
        }
    );

    const metadataPromise = new Promise(
        (resolve, reject) => {
          this.metadata.once('update', () => {
            resolve();
          });
          this.metadata.once('error', (err) => {
            reject(err);
          });

          this.metadata.initialize();
        }
    );

    Promise.all([indexPromise, metadataPromise]).then(() => {
      const sources = this.index.properties.sources.map((el) => {
        return iter(el, (k, v) => {
          // No handling for arrays. Are we expecting arrays anywhere in the index?
          return StringTemplate.coerce(v, this.metadata.properties);
        });
      });

      this.emit('sources-generated', sources);
      this._registerSources(sources);
      this.emit('sources-registered', this.storage.sources);
    }).catch((err) => {
      this._error(err);
    });
  }

  /**
   * Register the sources with the storage layer and their event handlers
   * @param {Array} sources
   * @private
   */
  _registerSources(sources) {
    sources.forEach((source) => {
      let instance;

      switch (source.type.toLowerCase()) {
        case 's3':
          instance = new S3(Object.assign(source.parameters, {bucket: this.index.bucket}));
          break;

        // case 'file':
        //  //
        //  break;
        // case 'consul':
        //  //
        //  break;
        default:
          this._error(new Error(`Source type ${source.type} not implemented`));
      }
      this.emit('source-instantiated', instance);

      this.storage.register(instance);
      this._registerSourceEvents(instance);
      this.emit('source-registered', instance);

      instance.initialize();
      this.emit('source-initialized', instance);
    });
  }

  /**
   * Bind event handlers for each source.
   * @param {*} source
   * @private
   */
  _registerSourceEvents(source) {
    source.on('startup', () => {
      Log.info(`${source.name} started up.`);
    });

    source.on('shutdown', () => {
      Log.info(`${source.name} shut down.`);
    });

    source.on('update', () => {
      Log.info(`${source.name}'s data was updated from its underlying source data.`);
      this.storage.update();
    });

    source.on('no-update', () => {
      Log.info(`${source.name} has no update to its underlying source data.`);
    });

    source.on('error', (err) => {
      Log.info(`${source.name} encountered the following error: ${err}`);
    });
  }

  /**
   * General handler for all errors
   * @param {Error} err
   * @returns {PluginManager}
   * @private
   */
  _error(err) {
    Log.error(err, {
      source: this.name,
      type: this.type
    });

    // Only emit an error event if there are listeners.
    if (this.listeners('error').length > 0) {
      this.emit('error', err);
    }

    return this;
  }
}

module.exports = PluginManager;
