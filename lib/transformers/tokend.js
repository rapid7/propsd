'use strict';

const TokendClient = require('./tokend-client');
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
    let defaultOptions = Immutable.Map({
      host: Config.get('tokend:host'),
      port: Config.get('tokend:port')
    });

    defaultOptions = defaultOptions.mergeDeep(options);

    const host = defaultOptions.get('host');
    const port = parseInt(defaultOptions.get('port'), 10);

    this._client = new TokendClient(host, port);
  }

  /**
   * Transform properties by fetching secrets from tokend
   *
   * @param  {Object} properties  properties that may contain $tokend values
   * @return {Promise<Properties>} properties that had $tokend values transformed
   */
  transform(properties) {
    const promises = collectTransformables(properties, []).map((info) => {
      const keyPath = info.get('keyPath');

      if (info.get('type') !== 'generic') {
        const message = `Invalid $tokend.type ${info.get('type')} for ${keyPath.join('.')}`;

        return Promise.reject(new Error(message));
      }

      return this._client.get(info.get('resource')).then((data) => {
        if (!data.hasOwnProperty('plaintext')) {
          return Promise.reject(new Error(`No "plaintext" key found in Vault for ${keyPath.join('.')}`));
        }

        return Promise.resolve(Immutable.Map().setIn(keyPath, data.plaintext));
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
