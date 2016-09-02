'use strict';

const http = require('http');

/**
 * @param {Object}  options
 */
class TokendTransformer {
  constructor(options) {
    options = Object.assign({
      host: '127.0.0.1',
      port: 4500
    }, options);

    this.host = options.host;
    this.port = options.port;
  }

  /**
   * Transform properties by fetching secrets from tokend
   *
   * @param  {Object}  properties
   * @return {Promise<Properties>}  resolved after properties have been transformed
   */
  transform(properties) {
    const promises = [];
    const transformedProperties = {};
    let key = null, keys = [];

    for (key in properties) {
      keys = Object.keys(properties[key]);
      if (keys.length === 1 && keys[0] === '$tokend') {
        promises.push(new Promise((resolve, reject) => {
          const params = properties[key]['$tokend'];
          let data = '';

          const req = http.get({
            host: this.host,
            port: this.port,
            path: params.resource
          }, (res) => {
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              data = JSON.parse(data);
              transformedProperties[key] = data.secret;
              resolve();
            });
          });

          req.on('error', (e) => {
            reject(e);
          });
        }));
      }
    }

    return Promise.all(promises).then(() => {
      return Object.assign({}, properties, transformedProperties);
    });
  }
}

module.exports = TokendTransformer;
