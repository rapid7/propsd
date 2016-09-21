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
    this._getRequestResponses = {};
  }

  /**
   * Poll Tokend for changes to secrets.
   *
   * @param {TokendClient~_fetchCallback} callback - Function called when updating secrets finishes.
   * @private
   */
  _fetch(callback) {
    const paths = Object.keys(this._pendingGetRequests);

    if (paths.length <= 0) {
      callback(null, {});
      return;
    }

    let updated = false;

    const work = (path, next) => {
      this._get(path, (error, data) => {
        const value = (error) ? JSON.stringify(error) : JSON.stringify(data);

        if (this._getRequestResponses[path] !== value) {
          this._getRequestResponses[path] = value;
          updated = true;
        }

        if (error) {
          this._pendingGetRequests[path] = Promise.reject(error);
        } else {
          this._pendingGetRequests[path] = Promise.resolve(data);
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

    each(paths, work, done);
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
