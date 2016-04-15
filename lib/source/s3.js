/* global Log, Config */
'use strict';

const EventEmitter = require('events').EventEmitter;
const Aws = require('aws-sdk');

const DEFAULT_INTERVAL = 60000;

class S3Parser {
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
    this.properties = properties.properties;
  }
}

class S3 extends EventEmitter {
  constructor(opts) {
    super();
    const options = opts || {};

    if (!options.hasOwnProperty('bucket') || !options.hasOwnProperty('path')) {
      throw new Error('Bucket or path not supplied');
    }

    if (!options.hasOwnProperty('name')) {
      this.name = `s3-${options.bucket}-${options.path}`;
    }

    this.interval = DEFAULT_INTERVAL;
    this.type = 's3';
    this._parser = options.parser || new S3Parser(options);
    this._ok = false;
    this._updated = null;

    /**
     * Initialize the s3 client
     */
    const config = {};
    const endpoint = options.endpoint || Config.get('index:endpoint');

    if (endpoint) {
      config.endpoint = new Aws.Endpoint(endpoint);
      config.s3ForcePathStyle = true;
    } else {
      config.region = Config.get('index:region');
    }
    this.service = new Aws.S3(config);

    this.configure(options);
    this.etag = null;
    this.properties = {};
  }

  /**
   * Clear the underlying properties object
   */
  clear() {
    this.properties = {};
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
   * @param {Object} params
   * @returns {Boolean}
   */
  configure(params) {
    let changed = false;

    changed = S3.setIfChanged(this, 'bucket', params.bucket || Config.get('index:bucket')) || changed;
    changed = S3.setIfChanged(this, 'interval', params.interval || DEFAULT_INTERVAL) || changed;
    changed = S3.setIfChanged(this, 'path', params.path) || changed;

    return changed;
  }

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
   * @return {S3} Receiver
   */
  shutdown() {
    if (!this._running) {
      return this;
    }

    this._ok = false;

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
   * Handle errors from underlying source facilities
   *
   * @emits {Error} error If any listeners have been registered
   *
   * @param  {Error} err An instance of Error
   * @return {S3} Reference to instance
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
    const _this = this;

    this.service.getObject({
      Bucket: this.bucket,
      Key: this.path,
      IfNoneMatch: this.etag
    }, (err, data) => {
      if (err) {
        if (err.code === 'NotModified') {
          return callback(null, false);
        }
        if (err.code === 'NoSuchKey') {
          return callback(null, {properties: {}});
        }

        return callback(err);
      }

      _this.etag = data.ETag;
      callback(null, data.Body);
    });
  }

  /**
   * Called by implementations to update source data
   *
   * @param {Buffer}  data  Updated data from an implementation-specific source
   * @return {S3} Reference to instance
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

module.exports = S3;
