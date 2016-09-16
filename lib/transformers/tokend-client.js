'use strict';

const http = require('http');

class TokendClient {
  /**
   * Create a new client for connecting to Tokend.
   *
   * @param {String} host  host to connect to Tokend on
   * @param {Number} port  port to connect to Tokend on
   */
  constructor(host, port) {
    this._host = host;
    this._port = port;
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
