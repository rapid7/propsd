var Parser = require('./index');

/**
 * Parse a JSON document comforming to
 * https://github.com/rapid7/propsd/blob/master/docs/schemas.md#10-schema
 *
 * @class Properties
 * @extends Parser
 */
var Properties = module.exports = function(options) {
  Parser.call(this, options);

  this.properties = {};
};

Parser.extends(Properties);

/**
 * Parse the raw response from a parent Source instance
 *
 * @param  {Buffer} data Raw response from Source
 * @return {Void}
 */
Properties.prototype.update = function(data) {
  var document = JSON.parse(data.toString('utf8'));

  // TODO Validation
  if (document.hasOwnProperty('properties')) {
    if(!(document.properties instanceof Object)) return Log.warn('document.properties is not an Object!');

    this.properties = document.properties;
  }
};

Parser.Properties = Properties;
