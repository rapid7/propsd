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
 * Transform properties by fetching secrets from Tokend
 */
class TokendTransformer {
  /**
   * Constructor
   * @param {Object} options  See TokendClient for options
   */
  constructor(options) {
    this._client = new TokendClient(options);
  }

  /**
   * Start polling Tokend for secrets
   *
   * @return {Promise}
   */
  initialize() {
    return this._client.initialize();
  }

  /**
   * Transform properties by fetching secrets from Tokend
   *
   * @param  {Object} properties  properties that may contain $tokend values
   * @return {Promise<Properties>} properties that had $tokend values transformed
   */
  transform(properties) {
    const promises = collectTransformables(properties, []).map((info) => {
      const keyPath = info.get('keyPath');
      let resolver = null,
          payload = {},
          source = 'Vault';

      switch (info.get('type')) {
        case 'generic':
          resolver = this._client.get(info.get('resource'));
          break;

        case 'transit':
          payload = {
            key: info.get('key'),
            ciphertext: info.get('ciphertext')
          };

          resolver = this._client.post(info.get('resource'), payload);
          break;

        case 'kms':
          source = 'KMS';
          payload = {
            ciphertext: info.get('ciphertext')
          };

          resolver = this._client.post(info.get('resource'), payload);
          break;

        default:
          Log.log('WARN', `Invalid $tokend.type ${info.get('type')} for ${keyPath.join('.')}`);
          return Promise.resolve(Immutable.Map().setIn(keyPath, null));
      }

      return resolver.then((data) => {
        if (!data.hasOwnProperty('plaintext')) {
          Log.log('WARN', `No "plaintext" key found in ${source} for ${keyPath.join('.')}`);
          return Promise.resolve(Immutable.Map().setIn(keyPath, null));
        }
        return Promise.resolve(Immutable.Map().setIn(keyPath, data.plaintext));
      })
      .catch((err) => {
        Log.log('WARN', err);
        return Promise.resolve(Immutable.Map().setIn(keyPath, null));
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

  /**
   * Bind event listeners to the TokendClient
   *
   * @param {String} eventName -
   * @param {Function} listener -
   */
  on(eventName, listener) {
    this._client.on(eventName, listener);
  }
}

module.exports = TokendTransformer;
