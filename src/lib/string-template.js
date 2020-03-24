'use strict';

/**
 * Use mustache template-style strings to interpolate data from an object.
 *
 * @class StringTemplate
 */
class StringTemplate {
  /**
   * Constructor
   * @param  {String} template The template input
   * @param  {Object} scope    The scope available for substitution values
   */
  constructor(template, scope) {
    this.template = template;
    this.scope = scope;
  }

  /**
   * Test if the provided string is a valid template.
   * @param {String} string
   * @return {boolean}
   */
  static isTemplate(string) {
    return this.CAPTURE.test(string);
  }

  /**
   * Check if string is a template, and if so, render it.
   * @param  {String} string Template string
   * @param  {Object} scope  Parameters available to the template
   * @return {String}        Rendered string
   */
  static coerce(string, scope) {
    if (!this.isTemplate(string)) {
      return string;
    }

    return new this(string, scope).toString();
  }

  /**
   * Try to interpolate strings in a deep object
   *
   * @param  {Object} object An Object that may have strings to be interpolated
   * @param  {Object} scope  Parameters available to the template
   * @return {Object}        A new object
   */
  static render(object, scope) {
    return iter(object, (value) => this.coerce(value, scope)); // eslint-disable-line no-use-before-define
  }

  /**
   * Convert a template to an interpolated string
   * @return {string}
   */
  toString() {
    return this.template.replace(this.constructor.CAPTURE, (match, capture) => {
      const path = capture.split(this.constructor.DELIMITER);

      let node = this.scope;

      // Traverse the scope object
      for (let i = 0; i < path.length; i++) {
        if (!node.hasOwnProperty(path[i])) {
          throw new ReferenceError(`Undefined parameter ${capture}`);
        }
        node = node[path[i]];
      }

      return node;
    });
  }
}

StringTemplate.CAPTURE = /\{\{ ?(.+?) ?\}\}/g;
StringTemplate.DELIMITER = ':';
StringTemplate.prototype.toJSON = StringTemplate.prototype.toString;

/* Export */
module.exports = StringTemplate;

/**
 * Helper: Recursively iterate through an object applying the callback to each value element
 *
 * @param {Object} object
 * @param {Function} handle
 * @returns {Object}
 */
function iter(object, handle) {
  // Array Values
  if (object instanceof Array) {
    return object.map((item) => {
      if (item instanceof Object) {
        return iter(item, handle);
      }

      return handle(item);
    });
  }

  const keys = Object.keys(object);

  // This may be something other than a simple Object, or it's empty
  if (keys.length === 0) {
    return object;
  }

  const collected = {};

  keys.forEach((key) => {
    if (object[key] instanceof Object) {
      return (collected[key] = iter(object[key], handle));
    }

    collected[key] = handle(object[key]);
  });

  return collected;
}
