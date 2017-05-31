'use strict';

/**
 * EC2 Tags Parser
 *
 * @class TagsParser
 *
 */
class Parser {
  /**
   * Constructor
   */
  constructor() {
    this.properties = {};
  }

  /**
   * Parse the property set and update the parser's properties and sources
   * @param {Object} data
   */
  update(data) {
    const properties = {};

    if (data.hasOwnProperty('Tags')) {
      data.Tags.forEach((tag) => {
        properties[tag.Key] = tag.Value;
      });
    }

    this.properties = properties;
  }
}

module.exports = Parser;
