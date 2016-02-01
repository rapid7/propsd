/**
 * Implement class inheritence
 *
 * In addition to the behavior provided by `Util.iherits`, this module also sets
 * the "class" namespace's prototype.
 */
var Extentable = module.exports = function() {};

Extentable.extends = function(child) {
  Object.setPrototypeOf(child, this);
  Object.setPrototypeOf(child.prototype, this.prototype);
};

Extentable.mixin = function(child) {
  var _this = this;

  Object.keys(this).forEach(function(method) {
    if (!(_this[method] instanceof Function)) return;

    child[method] = _this[method];
  });
};

Extentable.inherits = function(child, parent) {
  Object.setPrototypeOf(child.prototype, parent.prototype);
};

Extentable.override = function(name, method) {
  var parent = this.prototype[name];
  if (!(parent instanceof Function)) throw TypeError(name + ' is not a method in this prototype!');

  this.prototype[name] =  function() {
    var argv = Array.apply(null, arguments);
    argv.unshift(parent.bind(this));

    return method.apply(this, argv);
  };

  return this.prototype[name];
};
