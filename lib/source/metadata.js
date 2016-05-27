/* global Log, Config */

'use strict';

const EventEmitter = require('events').EventEmitter;
const Crypto = require('crypto');
const Path = require('path');
const Aws = require('aws-sdk');

const DEFAULT_INTERVAL = 60000;
const METADATA_LIST = /^(\d+)=(.+)$/;
const METADATA_TIMEOUT = 500;

const Parser = require('./metadata/parser');
const Util = require('./metadata/util');

/**
 * Metadata Source
 *
 * Expose EC2 metadata to the property-set
 *
 * @class Source.Metadata
 * @extends EventEmitter
 *
 * @param {Parser} parser
 * @param {Object} options
 *      - {Number} interval Polling interval. Default 30s.
 */
class Metadata extends EventEmitter {
  constructor(opts) {
    super();
    const options = opts || {};

    if (!options.hasOwnProperty('name')) {
      options.name = 'ec2-metadata';
    }
    if (!options.hasOwnProperty('namespace')) {
      options.namespace = 'instance';
    }

    this.interval = DEFAULT_INTERVAL;
    this.type = 'ec2-metadata';
    this._parser = new Parser(options);
    this.name = options.name || 'source';
    this._ok = false;
    this._updated = null;
    this.properties = {};

    /**
     * Initialize the metadata-service client
     */
    const host = options.host || Config.get('metadata:host');

    this.service = new Aws.MetadataService({
      httpOptions: {
        timeout: METADATA_TIMEOUT
      },
      host
    });

    this.configure(options);
    this.signature = null;
  }

  /**
   * Check the status of the polling interval loop
   *
   * @return {Boolean} True if the pooling loop is running
   */
  get _running() {
    return !!this._timer;
  }

  /**
   * Metadata version
   *
   * Used to prepend paths for calls to the EC2 Metadata Service,
   * e.g. /<version>/meta-data/ami-id
   *
   * @returns {string}
   * @private
   */
  get _version() {
    return this.constructor.version;
  }

  /**
   * @param {Object} params
   * @returns {Boolean}
   */
  configure(params) {
    return Metadata.setIfChanged(this, 'interval', params.interval || DEFAULT_INTERVAL) || false;
  }

  /**
   * Start the polling interval loop
   *
   * @return {Metadata} Reference to instance
   */
  initialize() {
    if (this._timer) {
      return this;
    }

    Log.info(`Initializing ${this.type} source ${this.name}`, {
      source: this.name,
      type: this.type
    });

    // Initialize state to 'RUNNING'
    this._timer = true;
    const _this = this;

    this.emit('startup');

    (function poll() {
      const timer = Date.now();

      Log.debug(`Polling source ${_this.name} for updates`, {
        source: _this.name,
        type: _this.type
      });

      _this._fetch((err, data) => {
        // If `shutdown()` was called _during_ a fetch operation, `clearTimeout()`
        // will have no effect. Instead, we overload `_interval` as a state to detect
        // if a shutdown has been initiated. False-y -> don't set another timeout.
        if (_this._running) {
          _this._timer = setTimeout(poll, _this.interval);
        }
        if (err) {
          return _this._error(err);
        }

        Log.debug(`Polled source ${_this.name} in ${(Date.now() - timer)}ms`, {
          source: _this.name,
          type: _this.type
        });

        if (data) {
          return _this._update(data);
        }
        _this.emit('no-update');

        Log.debug(`Source ${_this.name} is up to date`, {
          source: _this.name,
          type: _this.type
        });
      });

      // Start the polling loop
    }());

    return this;
  }

  /**
   * Stop the polling interval loop
   *
   * @return {Metadata} Receiver
   */
  shutdown() {
    if (!this._running) {
      return this;
    }

    this._ok = false;
    this.signature = null;

    Log.info(`Shutting down ${this.type} source ${this.name}`, {
      source: this.name,
      type: this.type
    });

    clearTimeout(this._timer);
    delete this._timer;

    this.emit('shutdown');
    return this;
  }

  /**
   * Return an object describing the source-instance's current status
   *
   * @return {Object}
   */
  status() {
    return {
      ok: this._ok,
      updated: this._updated,
      interval: this.interval,
      running: this._running
    };
  }

  /**
   * Clear the underlying properties object
   */
  clear() {
    this.properties = {};
  }

  /**
   * Fetch all values from the EC2 metadata tree
   *
   * @param  {Function} callback(err, paths) Return an error or a hash of paths and their values
   * @private
   */
  _traverse(callback) {
    const values = {};
    const paths = ['/meta-data/', '/dynamic/'];

    Util.each(paths, (path, next) => {
      this.service.request(Path.join('/', this._version, path), (err, data) => {
        if (err) {
          return next(err);
        }

        // This is a list! Split new-line delimited strings into an array and add to tail of paths
        if (path.slice(-1) === '/') {
          const items = data.trim().split('\n');

          // Is this a list?
          if (items.reduce((memo, item) => memo && METADATA_LIST.test(item), true)) {
            const list = values[path.slice(1, -1)] = [];

            items.forEach((item) => {
              const match = item.match(METADATA_LIST);

              if (match) {
                list[match[1]] = match[2];
              }
            });

            return next();
          }

          items.forEach((node) => paths.push(Path.join(path, node)));
          return next();
        }

        // Remove leading `/`
        values[path.slice(1)] = data;
        next();
      });
    }, (err) => callback(err, values), null);
  }

  /**
   * Called by implementations to update source data
   *
   * @param {Buffer}  data  Updated data from an implementation-specific source
   * @return {Metadata} Reference to instance
   * @private
   */
  _update(data) {
    this._parser.update(data);
    this.properties = this._parser.properties;
    this._updated = new Date();
    this._ok = true;

    Log.info(`Updated source ${this.name}`, {
      source: this.name,
      type: this.type
    });
    this.emit('update', this);

    return this;
  }

  /**
   * Handle errors from underlying source facilities
   *
   * @emits {Error} error If any listeners have been registered
   *
   * @param  {Error} err An instance of Error
   * @return {Metadata} Reference to instance
   * @private
   */
  _error(err) {
    this._ok = false;
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

  /**
   *
   * @param {Function} callback
   * @private
   */
  _fetch(callback) {
    this._traverse((err, data) => {
      if (err) {
        return callback(err);
      }

      // Detect change by hashing the fetched data
      const hash = Crypto.createHash('sha1');

      Object.keys(data)
        .sort()
        .forEach((key) => {
          hash.update(`${key}:${data[key]}`);
        });

      const signature = hash.digest('base64');

      if (this.signature === signature) {
        return callback(null, false);
      }

      this.signature = signature;
      callback(null, data);
    });
  }

  /**
   * Helper method to detect parameter changes
   *
   * @param {Object}  scope The target object on which to set a parameter
   * @param {String}  key   The property of `scope` to set
   * @param {*}   value The value to compare and set
   * @return {Boolean} True if the parameter has been updated
   * @static
   */
  static setIfChanged(scope, key, value) {
    if (scope[key] === value) {
      return false;
    }

    scope[key] = value; // eslint-disable-line no-param-reassign
    return true;
  }
}

Metadata.version = 'latest';

/* Export */
module.exports = Metadata;
