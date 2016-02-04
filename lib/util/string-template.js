'use strict';

/**
 * Class: StringTemplate
 *
 * @param  {String} template The template input
 * @param  {Object} scope    The scope available for substitution values
 */
class StringTemplate {
  constructor(template, scope) {
    this.template = template;
    this.scope = scope;
  }

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
    if (!this.isTemplate(string)) return string;

    return new this(string, scope).toString();
  }

  toString() {
    const _this = this;

    return this.template.replace(this.constructor.CAPTURE, function (match, capture) {
      const path = capture.split(_this.constructor.DELIMITER);
      let node = _this.scope;

      // Traverse the scope object
      for (let i = 0; i < path.length; i++) {
        if (!node.hasOwnProperty(path[i])) throw ReferenceError('Undefined parameter ' + capture);
        node = node[path[i]];
      }

      return node;
    });
  }
}

StringTemplate.CAPTURE = /\{\{ ?(.+?) ?\}\}/g;
StringTemplate.DELIMITER = ':'
StringTemplate.prototype.toJSON = StringTemplate.prototype.toString;

/* Export */
module.exports = StringTemplate;
