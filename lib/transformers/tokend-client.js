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
   *  @callback TokendClass~_getCallback
   *
   *  @param {Error} error - Error returned when secret retrieval fails.
   *  @param {Object} secret - Data returned when secret retrieval succeeds.
   *  @private
   */
}

module.exports = TokendClient;
