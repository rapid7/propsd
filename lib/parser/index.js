var Extendable = require('../util/extendable');
var StringTemplate = require('../util/string-template');

/**
 * Abstract parent for parser implementations
 *
 * @abstract
 * @class Parser
 * @extends Extendable
 */
var Parser = module.exports = function() {
};

Extendable.extends(Parser);

/**
 * Called by implementations to update source data
 *
 * @abstract
 *
 * @param {Buffer}  data  Updated data from an implementation-specific source
 * @return {Void}
 */
Parser.prototype.update = function(data) {
  throw ReferenceError('Method update must be implemented!');
};

require('./properties');
require('./sources');
