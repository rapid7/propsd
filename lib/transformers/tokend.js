'use strict';

const http = require('http');
const Immutable = require('immutable');

/**
 * Walk a properties object looking for transformable values
 *
 * @param {Object} properties  an object to search for transformable values
 * @param {Array} keyPath  accumulated path of keys where transformable value was found
 * @return {Array<Immutable.Map>} transformable data with injected key path
 */
function collectTransformables(properties, keyPath) {
  let results = [];

  // Ensure we're walking an Object. `== null` covers both null and undefined.
  if (properties == null || Object.getPrototypeOf(properties) !== Object.prototype) { // eslint-disable-line eqeqeq
    return results;
  }

  // If we're walking a $tokend object, pass it to the callback.
  const keys = Object.keys(properties);

  if (keys.length === 1 && keys[0] === '$tokend') {
    return results.concat(Immutable.Map(properties.$tokend).set('keyPath', keyPath));
  }

  Object.keys(properties).forEach((key) => {
    const value = properties[key];

    // Don't walk anything that's not an Object. `!= null` covers both null and undefined.
    if (value != null && Object.getPrototypeOf(value) === Object.prototype) { // eslint-disable-line eqeqeq
      results = results.concat(collectTransformables(value, keyPath.concat(key)));
    }
  });

  return results;
}

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
   * @return {Promise<Properties>}  the transformed properties
   */
  transform(properties) {
    const promises = collectTransformables(properties, []).map((info) => {
      return new Promise((resolve, reject) => {
        let data = '';

        const req = http.get({
          host: this.host,
          port: this.port,
          path: info.get('resource')
        }, (res) => {
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            data = JSON.parse(data);
            resolve(Immutable.Map().setIn(info.get('keyPath'), data.secret));
          });
        });

        req.on('error', (e) => {
          reject(e);
        });
      });
    });

    return Promise.all(promises).then((values) => {
      let transformedProperties = Immutable.Map();

      values.forEach((value) => {
        transformedProperties = transformedProperties.mergeDeep(value);
      });

      return transformedProperties.toJS();
    });
  }
}

module.exports = TokendTransformer;
