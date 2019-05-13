'use strict';

const http = require('http');
const Immutable = require('immutable');
const each = require('../source/metadata/util').each;
const Source = require('../source/common');

/**
 * Do nothing parser for Tokend. We're leveraging Source.Polling so we need a Parser class.
 */
class TokendParser {
  /**
   * Constructor
   */
  constructor() {
    this.properties = {};
    this.sources = {};
  }

  /**
   * Called when data returned from Tokend changes
   */
  update() {
  }
}

/**
 * Fetches secrets from Tokend
 */
class TokendClient extends Source.Polling(TokendParser) {
  /**
   * Create a new client for connecting to Tokend.
   *
   * @param {Object} options
   * @param {String} options.host  host to connect to Tokend on
   * @param {Number} options.port  port to connect to Tokend on
   */
  constructor(options) {
    let defaultOptions = Immutable.Map({
      host: Config.get('tokend:host'),
      port: Config.get('tokend:port'),
      interval: Config.get('tokend:interval')
    });

    defaultOptions = defaultOptions.mergeDeep(options);

    super('tokend', defaultOptions.toJS());

    this._host = defaultOptions.get('host');
    this._port = Number(defaultOptions.get('port'));
    this._pendingGetRequests = {};
    this._cachedGetResponses = {};
    this._pendingPostRequests = {};
  }

  /**
   * Poll Tokend for changes to secrets.
   *
   * @param {TokendClient~_fetchCallback} callback - Function called when updating secrets finishes.
   * @private
   */
  _fetch(callback) {
    // If this is the first call to _fetch, there will be no _state. We need to return empty
    // properties so an "update" event fires and fulfills the Promise returned by initialize().
    if (this._state === null) {
      this._state = 'polling';
      callback(null, {});

      return;
    }

    let updated = false;

    const work = (path, next) => {
      this._get(path, (error, secret) => {
        const response = (error) ? JSON.stringify(error) : JSON.stringify(secret);

        if (this._cachedGetResponses[path] !== response) {
          this._cachedGetResponses[path] = response;
          updated = true;
        }

        // Update _pendingGetRequests so subsequent calls to get() return the latest value.
        if (error) {
          this._pendingGetRequests[path] = Promise.reject(error);
        } else {
          this._pendingGetRequests[path] = Promise.resolve(secret);
        }

        next();
      });
    };

    const done = () => {
      if (updated) {
        callback(null, {});
      } else {
        callback(null, Source.NO_UPDATE);
      }
    };

    each(Object.keys(this._pendingGetRequests), work, done);
  }

  /**
   * @callback TokendClient~_fetchCallback
   *
   * @param {Error} error - Error returned when updating secrets fails.
   * @param {Object} properties - Properties returned updating secrets succeeds.
   * @private
   */

  /**
   * Get a secret from Tokend
   *
   * @param {String} path  path where the secret in Tokend can be found
   * @return {Promise}  resolves with the secret as an Object or rejects with an Error
   */
  get(path) {
    if (!this._pendingGetRequests.hasOwnProperty(path)) {
      this._pendingGetRequests[path] = new Promise((resolve, reject) => {
        this._get(path, (error, secret) => {
          // Cache the response so _fetch can determine if it's changed.
          this._cachedGetResponses[path] = (error) ? JSON.stringify(error) : JSON.stringify(secret);

          if (error) {
            return reject(error);
          }
          resolve(secret);
        });
      });
    }

    return this._pendingGetRequests[path];
  }

  /**
   * Decrypt a transit secret with Tokend
   *
   * @param {String} path - path where the secret in Tokend can be found
   * @param {Object} data - JSON data with information about the secret
   * @return {Promise} - resolves with the secret as an Object or rejects with an Error
   */
  post(path, data) {
    const postId = `${path}.${data.key}.${data.ciphertext}`;

    if (!this._pendingPostRequests.hasOwnProperty(postId)) {
      this._pendingPostRequests[postId] = new Promise((resolve, reject) => {
        this._post(path, data, (error, secret) => {
          if (error) {
            return reject(error);
          }
          resolve(secret);
        });
      });
    }

    return this._pendingPostRequests[postId];
  }

  /**
   * Removes a request's fulfilled Promise from the specified pending request cache
   * @param {string} type
   * @param {string} id
   */
  clearCacheAtKey(type, id) {
    let cache = null;

    switch (type.toLowerCase()) {
      case 'get':
        cache = this._pendingGetRequests;
        break;
      case 'post':
        cache = this._pendingPostRequests;
        break;
      default:
        throw new Error(`A ${type} request does not map to an existing cache.`);
    }

    if (cache[id]) {
      delete cache[id];
    } else {
      Log.log('DEBUG', `No data at ${id} in ${type} cache`);
    }
  }

  /**
   * Implementation for getting a secret from Tokend
   *
   * @param {String} path - Path where the secret in Tokend can be found.
   * @param {TokendClient~_getCallback} callback - Function called when the secret's retrieved.
   * @private
   */
  _get(path, callback) {
    let data = '';

    const req = http.get({
      host: this._host,
      port: this._port,
      path
    }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          data = JSON.parse(data);
        } catch (e) {
          return callback(e, null);
        }
        callback(null, data);
      });
    });

    req.on('error', (e) => {
      callback(e, null);
    });
  }

  /**
   * @callback TokendClass~_getCallback
   *
   * @param {Error} error - Error returned when secret retrieval fails.
   * @param {Object} secret - JSON data with information about the secret
   * @param {Object} secret - Data returned when secret retrieval succeeds.
   * @private
   */

  /**
   * Implementation for decrypting a transit secret with Tokend
   *
   * @param {String} path - Path where the secret in Tokend can be found.
   * @param {Object} data - JSON data with information about the secret
   * @param {TokendClient~_postCallback} callback - Function called when the secret's retrieved.
   * @private
   */
  _post(path, data, callback) {
    let secret = '';

    const content = JSON.stringify(data);
    const req = http.request({
      host: this._host,
      port: this._port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(content)
      }
    }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        secret += chunk;
      });
      res.on('end', () => {
        try {
          secret = JSON.parse(secret);
        } catch (e) {
          return callback(e, null);
        }

        if (res.statusCode !== 200) {
          callback(new Error("ERROR: Received a non 200 status code from tokend"), secret.error.message);
        }

        callback(null, secret);
      });
    });

    req.on('error', (e) => {
      callback(e, null);
    });

    req.write(content);
    req.end();
  }

  /**
   *  @callback TokendClass~_postCallback
   *
   *  @param {Error} error - Error returned when secret retrieval fails.
   *  @param {Object} secret - Data returned when secret retrieval succeeds.
   *  @private
   */
}

module.exports = TokendClient;
