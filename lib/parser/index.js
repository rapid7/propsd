'use strict';

/**
 * Abstract parent for parser implementations
 *
 * @abstract
 * @class Parser
 * @extends Extendable
 */
class Parser {
  constructor(source) {
    this.source = source;
  }

  /**
   * Called by implementations to update source data
   *
   * @abstract
   *
   * @param {Buffer}  data  Updated data from an implementation-specific source
   */
  update(data) {
    throw ReferenceError('Method update must be implemented!');
  }
}

/* Export */
module.exports = Parser;