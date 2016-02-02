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

  toString() {
    var _this = this;

    return this.template.replace(this.constructor.CAPTURE, function(match, capture) {
      var path = capture.split('.');
      var node = _this.scope;

      // Traverse the scope object
      for (var i = 0; i < path.length; i++) {
        if(!node.hasOwnProperty(path[i])) throw ReferenceError('Undefined parameter ' + capture);
        node = node[path[i]];
      }

      return node;
    });
  }
}

StringTemplate.CAPTURE = /\{\{ ?(.+?) ?\}\}/g;
StringTemplate.prototype.toJSON = StringTemplate.prototype.toString;

/* Export */
module.exports = StringTemplate;
