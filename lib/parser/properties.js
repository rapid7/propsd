'use strict';

const Parser = require('./index');

/**
 * Parse a JSON document comforming to
 * https://github.com/rapid7/propsd/blob/master/docs/schemas.md#10-schema
 *
 * @class Properties
 * @extends Parser
 */
class Properties extends Parser {
  constructor(source, options) {
    super(source, options);
    this.properties = {};
  }

  /**
   * Parse the raw response from a parent Source instance
   *
   * @param  {Buffer} data Raw response from Source
   * @return {Void}
   */
  update(data) {
    const document = JSON.parse(data.toString('utf8'));

    // TODO Validation
    if (document.hasOwnProperty('properties')) {
      if (!(document.properties instanceof Object)) return Log.warn('document.properties is not an Object!');

      this.properties = document.properties;
    }
  }
}

/* Export */
module.exports = Properties;
