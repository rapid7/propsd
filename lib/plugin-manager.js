/* global Log, Config */
'use strict';

const EventEmitter = require('events').EventEmitter;
const StringTemplate = require('./string-template');
const Metadata = require('./source/metadata');
const S3 = require('./source/s3');
const Consul = require('./source/consul');

// TODO: Implement this source type
// const File = require('./source/file');

const DEFAULT_INDEX_INTERVAL = Config.get('index:interval') || 60000; // eslint-disable-line rapid7/static-magic-numbers
const DEFAULT_INDEX_BUCKET = Config.get('index:bucket');
const DEFAULT_INDEX_PATH = Config.get('index:path');

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

class S3IndexParser {
  constructor() {
    this.properties = {};
  }

  update(data) {
    let properties = {};

    try {
      properties = JSON.parse(data.toString());
    } catch (e) {
      // We should have an error condition but tbd
    }
    this.properties = properties.sources;
  }
}

class PluginManager extends EventEmitter {
  /**
   * Creates a new instance of the PluginManager
   *
   * The following options are valid:
   * - interval (Number, default 60000) Interval for the index source timer
   * - bucket (String) The bucket where index data (and other configuration data) is stored
   * - path (String) The path to the index document in the bucket
   *
   * If a configuration document is provided when running the server, the options Object can be omitted
   * as the data will be filled from the global Config.
   *
   * @param {Storage} storage
   * @param {Object} options
   */
  constructor(storage, options) {
    super();

    const configuration = options || Object.create(null);

    this.storage = storage;

    this.index = new S3({
      interval: configuration.interval || DEFAULT_INDEX_INTERVAL,
      bucket: configuration.bucket || DEFAULT_INDEX_BUCKET,
      path: configuration.path || DEFAULT_INDEX_PATH,
      parser: new S3IndexParser()
    });

    this.index.on('error', (error) => {
      this._error(error, this.index);
    });
    this.index.on('update', () => {
      this._loadSourcesFromIndex();
    });

    this.metadata = new Metadata({
      host: configuration.metadataHost || Config.get('metadata:host'),
      interval: configuration.metadataInterval || Config.get('metadata:interval')
    });
    this.metadata.on('error', (error) => {
      this._error(error);
      this.metadata.once('update', () => this._loadSourcesFromIndex());
    });

    this._running = false;
    this._ok = true;

    // TODO: Determine what else to log
    this._defaultLogMetadata = {

    };
  }

  /**
   * Initialize the PluginManager's index and metadata source
   */
  initialize() {
    Log.info('Initializing index and metadata', this._defaultLogMetadata);
    this._running = true;
    this.metadata.initialize().then(() => {
      this.index.initialize();
    });
  }

  /**
   * Shutdown the plugin manager's sources and then the plugin manager
   */
  shutdown() {
    Log.info('Shutting down sources', this._defaultLogMetadata);
    this.storage.clear();

    this._running = false;
  }

  /**
   * Get the plugin manager's status
   * @returns {{running: boolean, ok: boolean, sources: Array}}
   */
  status() {
    return {
      running: this._running,
      ok: this._ok,
      sources: this._sourcesStatus()
    };
  }

  /**
   * Gets an array of source statuses
   * @returns {Array}
   * @private
   */
  _sourcesStatus() {
    return this.storage.sources.map((source) => {
      return {
        name: source.name,
        type: source.type,
        status: source.status()
      };
    });
  }

  /**
   * Called when either the S3 index or EC2 metadata are updated. If parsing of
   * of composite properties fails, an error is logged. Once parsing succeeds,
   * any additional sources in the index are registered.
   * @private
   */
  _loadSourcesFromIndex() {
    let sources = [];

    if (Object.keys(this.metadata.properties).length > 0) {
      const configProps = Config.get('properties');

      if (configProps) {
        this.metadata.properties = Object.assign(configProps, this.metadata.properties);
      }
    }
    try {
      sources = this.index.properties.map((el) => {
        return iter(el, (k, v) => {
          // TODO: No handling for arrays. Are we expecting arrays anywhere in the index?
          return StringTemplate.coerce(v, this.metadata.properties);
        });
      });
    } catch (error) {
      this._error(error);
      return;
    }

    this._ok = true;
    this.emit('sources-generated', sources);
    this._registerSources(sources);
    this.emit('sources-registered', this.storage.sources);
  }

  /**
   * Register the sources with the storage layer and their event handlers
   * @param {Array} sources
   * @private
   */
  _registerSources(sources) {
    this.storage.clear();

    sources.forEach((source) => {
      let instance;

      switch (source.type.toLowerCase()) {
        case 's3':

          // TODO: Support for sources in other buckets
          instance = new S3(Object.assign(source.parameters, {bucket: this.index.bucket}));
          break;

        // case 'file':
        //  //
        //  break;
        case 'consul':
          const existingConsulSources = this.storage.sources.filter((el) => el.type === 'consul');

          if (existingConsulSources.length <= 0) {
            instance = new Consul({
              host: Config.get('consul:host'),
              port: Config.get('consul:port'),
              secure: Config.get('consul:secure')
            });
          }
          break;
        default:
          this._error(new Error(`Source type ${source.type} not implemented`));
      }

      if (instance) {
        this._registerSource(instance);
      }
    });
  }

  /**
   * Register source with storage layer, register events,
   * initialize the source, and emit requisite events.
   *
   * @param {Metadata|S3|Consul} instance
   * @private
   */
  _registerSource(instance) {
    this.emit('source-instantiated', instance);

    this.storage.register(instance);
    this._registerSourceEvents(instance);
    this.emit('source-registered', instance);

    instance.initialize();
    this.emit('source-initialized', instance);
  }

  /**
   * Bind event handlers for each source.
   * @param {Metadata|S3|Consul} source
   * @private
   */
  _registerSourceEvents(source) {
    source.on('init', (logMetadata) => {
      Log.info(`Initializing ${source.type} source ${source.name}`, Object.assign({},
          this._defaultLogMetadata, {
            sourceName: source.name,
            sourceType: source.type
          },
          logMetadata));
    });

    source.on('startup', (logMetadata) => {
      Log.info(`${source.name} started up successfully.`, Object.assign({},
          this._defaultLogMetadata, {
            sourceName: source.name,
            sourceType: source.type
          },
          logMetadata));
    });

    source.on('shutdown', (logMetadata) => {
      Log.info(`Shutting down ${source.type} source ${source.name}`, Object.assign({},
          this._defaultLogMetadata, {
            sourceName: source.name,
            sourceType: source.type
          },
          logMetadata));
    });

    source.on('update', (instance, logMetadata) => {
      Log.info(`Updated source ${instance.name}`, Object.assign({},
          this._defaultLogMetadata, {
            sourceName: source.name,
            sourceType: source.type
          },
          logMetadata));
      this.storage.update();
    });

    source.on('no-update', (logMetadata) => {
      Log.debug(`${source.name} has no update to its underlying source data.`, Object.assign({},
          this._defaultLogMetadata, {
            sourceName: source.name,
            sourceType: source.type
          },
          logMetadata));
    });

    source.on('error', (err, logMetadata) => {
      this._error(err, source, logMetadata);
    });
  }

  /**
   * General handler for all errors
   * @param {Error} err
   * @param {Metadata|S3|Consul} [source]
   * @param {object} [logMetadata]
   * @returns {PluginManager}
   * @private
   */
  _error(err, source, logMetadata) {
    this._ok = false;

    const metadata = Object.assign({}, this._defaultLogMetadata,
        (source) ? {sourceName: source.name, sourceType: source.type} : {},
        logMetadata);

    // Only emit an error event if there are listeners.
    if (this.listeners('error').length > 0) {
      this.emit('error', err, metadata);
    } else {
      Log.error(err, metadata);
    }

    return this;
  }
}

module.exports = PluginManager;
