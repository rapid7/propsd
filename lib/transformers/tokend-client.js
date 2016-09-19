'use strict';

const http = require('http');
const Immutable = require('immutable');

class TokendClient {
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
      port: Config.get('tokend:port')
    });

    defaultOptions = defaultOptions.mergeDeep(options);

    this._host = defaultOptions.get('host');
    this._port = parseInt(defaultOptions.get('port'), 10);
    this._pendingGetRequests = {};
  }

  /**
   * Get a secret from Tokend
   *
   * @param {String} path  path where the secret in Tokend can be found
   * @return {Promise}  resolves with the secret as an Object or rejects with an Error
   */
  get(path) {
    if (!this._pendingGetRequests.hasOwnProperty(path)) {
      this._pendingGetRequests[path] = new Promise((resolve, reject) => {
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
              return reject(e);
            }
            resolve(data);
          });
        });

        req.on('error', (e) => {
          reject(e);
        });
      });
    }

    return Promise.resolve(this._pendingGetRequests[path]);
  }
}

module.exports = TokendClient;
