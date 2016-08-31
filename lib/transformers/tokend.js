'use strict';

/**
 */
class TokendTransformer {
  constructor() {
  }

  /**
   * Transform properties by fetching secrets from tokend
   *
   * @param  {Object}  properties
   * @return {Promise<Properties>}  resolved after properties have been transformed
   */
  transform(properties) {
    return new Promise((resolve) => {
      return resolve(properties);
    });
  }
}

module.exports = TokendTransformer;
