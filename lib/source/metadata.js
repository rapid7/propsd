/* global Log, Config */

'use strict';

const EventEmitter = require('events').EventEmitter;
const Crypto = require('crypto');
const Path = require('path');
const Aws = require('aws-sdk');

const DEFAULT_INTERVAL = 60000;
const DEFAULT_PARALLEL = 16;
const METADATA_LIST = /^(\d+)=(.+)$/;
const METADATA_TIMEOUT = 500;

/**
 * Iterate over a list of tasks in parallel, passing one to each call of the
 * `work` function. When all tasks are complete, or an error is encountered, call the
 * `done` function, with an error if one occurred.
 *
 * This implementation iterates over a work-list non-destructively, without cloning it.
 * meaning that more tasks can be added safely while the work-loop is running.
 *
 * @param  {Array}    list    Set of tasks to work on
 * @param  {Function} work    The operation to perform on each element of `list`
 * @param  {Function} done    Callback on error or completion
 * @param  {Object}   s { parallel: Number limit parallel tasks. Default 16 }
 */
function each(list, work, done, s) {
  const state = s || {
    parallel: DEFAULT_PARALLEL,
    error: false
  };

  // Default values
  if (!Number(state.running)) {
    state.running = 0;
  }
  if (!Number(state.cursor)) {
    state.cursor = 0;
  }

  // No more items to process
  if (state.cursor >= list.length) {
    // Call done if this was the last branch
    if (state.running === 0 && !state.error) {
      done();
    }

    return;
  }

  // Already enough tasks in flight
  if (state.running >= state.parallel) {
    return;
  }

  // Get an item off of the list, move up the cursor, and get a semaphore.
  const item = list[state.cursor];

  // Obtain a semaphore
  state.running += 1;
  state.cursor += 1;

  // Branch parallel requests
  while (state.running < state.parallel && state.cursor < list.length) {
    each(list, work, done, state);
  }

  // Process this branch's task
  work(item, (err) => {
    // Release the semaphore
    state.running -= 1;

    // An error has occurred. Just bail.
    if (state.error) {
      return;
    }

    if (err) {
      state.error = true;
      return done(err); // eslint-disable-line consistent-return
    }

    // Iterate
    each(list, work, done, state);
  });
}

/**
 * Metadata Parser
 *
 * @class MetadataParser
 *
 */
class MetadataParser {
  constructor(options) {
    this.properties = {};
    this.namespace = options.namespace;
  }

  update(data) {
    const properties = {};

    // Get region and account ID from the ID document
    try {
      const identity = JSON.parse(data['dynamic/instance-identity/document']);

      properties.account = identity.accountId;
      properties.region = identity.region;
    } catch (e) {
      /* Don't do anything */
    }

    // Expose instance identification parameters
    properties.identity = {
      document: data['dynamic/instance-identity/document'],
      dsa2048: data['dynamic/instance-identity/dsa2048'],
      pkcs7: data['dynamic/instance-identity/pkcs7'],
      signature: data['dynamic/instance-identity/signature']
    };

    // Get instance profile credentials
    const IAM_METADATA_PATH = 'meta-data/iam/security-credentials/';
    const credentialsPaths = Object.keys(data).filter((path) =>
    Path.relative(IAM_METADATA_PATH, path).slice(0, 2) !== '..');

    // Use the first set of credentials
    if (credentialsPaths.length > 0) {
      try {
        const credentials = JSON.parse(data[credentialsPaths[0]]);

        properties.credentials = {
          lastUpdated: credentials.LastUpdated,
          type: credentials.Type,
          accessKeyId: credentials.AccessKeyId,
          secretAccessKey: credentials.SecretAccessKey,
          expires: credentials.Expiration
        };
      } catch (e) {
        /* Don't do anything */
      }
    }

    // Common meta-data properties
    ['local-ipv4', 'local-hostname', 'instance-type', 'instance-id', 'hostname',
      'ami-id', 'public-hostname', 'public-ipv4', 'public-keys', 'reservation-id',
      'security-groups'].forEach((name) => properties[name] = data[Path.join('meta-data', name)]);

    properties['availability-zone'] = data['meta-data/placement/availability-zone'];

    // Grok the network interface parameters
    const mac = data['meta-data/mac'];

    if (mac) {
      const interfacePath = Path.join('meta-data/network/interfaces/macs', mac);

      properties['vpc-id'] = data[Path.join(interfacePath, 'vpc-id')];
      properties['subnet-id'] = data[Path.join(interfacePath, 'subnet-id')];

      const interfaceProperties = properties.interface = {};

      ['vpc-ipv4-cidr-block', 'subnet-ipv4-cidr-block', 'public-ipv4s', 'mac',
        'local-ipv4s', 'interface-id'
      ].forEach((name) => interfaceProperties[name] = data[Path.join(interfacePath, name)]);
    }

    this.properties = {};
    this.properties[this.namespace] = properties;
  }
}

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
    this._parser = new MetadataParser(options);
    this.name = options.name || 'source';
    this._ok = false;
    this._updated = null;

    /**
     * Initialize the metadata-service client
     */
    this.service = new Aws.MetadataService({
      httpOptions: {
        timeout: METADATA_TIMEOUT
      },
      host: Config.get('metadata:host')
    });

    this.configure(options);
    this.signature = null;
  }

  /**
   * The source's properties
   *
   * @returns {Object}
   */
  get properties() {
    return this._parser.properties;
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
   * The source type
   *
   * @returns {string}
   * @private
   */
  get _type() {
    return this.constructor.type;
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

    Log.info(`Initializing ${this._type} source ${this.name}`, {
      source: this.name,
      type: this._type
    });

    // Initialize state to 'RUNNING'
    this._timer = true;
    const _this = this;

    this.emit('startup');

    (function poll() {
      const timer = Date.now();

      Log.debug(`Polling source ${_this.name} for updates`, {
        source: _this.name,
        type: _this._type
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
          type: _this._type
        });

        if (data) {
          return _this._update(data);
        }
        _this.emit('no-update');

        Log.debug(`Source ${_this.name} is up to date`, {
          source: _this.name,
          type: _this._type
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

    Log.info(`Shutting down ${this._type} source ${this.name}`, {
      source: this.name,
      type: this._type
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
      interval: this._timer,
      running: this._running
    };
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

    each(paths, (path, next) => {
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
    this._updated = new Date();
    this._ok = true;

    Log.info('Updated source ' + this.name, {
      source: this.name,
      type: this._type
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
      type: this._type
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
Metadata.type = 'ec2-metadata';

/* Export */
module.exports = Metadata;
