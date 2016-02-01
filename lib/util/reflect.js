/**
 * Shallow merge helper
 *
 * @param {Object} source       Object from which keys are coppied out of
 * @param {Object} destination  Boject into which keys are coppied
 *
 * @return {Object}             Returns reference to the destination Object
 */
function merge(source, destination) {
  destination = destination || {};
  if (!(source instanceof Object)) return destination;

  Object.keys(source).forEach(function(key) {
    destination[key] = source[key];
  });

  return destination;
}
exports.merge = merge;
exports.clone = merge;


/**
 * Deep merge helper
 *
 * @param {Object} source       Object from which keys are coppied out of
 * @param {Object} destination  Boject into which keys are coppied
 *
 * @return {Object}             Returns reference to the destination Object
 */
function deep_merge(source, destination) {
  destination = destination || {};
  if (!(source instanceof Object)) return destination;

  Object.keys(source).forEach(function(key) {
    if (source[key] !== null &&
      !(source[key] instanceof Function) && // Not a function
      source[key] instanceof Object) {

        return deep_merge(source[key], destination[key] || {});
    }

    destination[key] = source[key];
  });

  return destination;
}
exports.merge.deep = deep_merge;
exports.clone.deep = deep_merge;

/**
 * Deep equality comparison
 * @param  {Object} a [description]
 * @param  {Object} b [description]
 * @return {Boolean}   True if a and b are the same reference, of have the same content
 */
function equal(a, b) {
  // Are both operands references to the same Object, or equivalent scalars?
  // Note that this compares `null` and `undefined` strictly, which is the desired behavior
  if (a === b) return true;

  // If both operands are references to different functions, they are inherently non-equal
  if (a instanceof Function && b instanceof Function) return false;

  // If both operands were null, the first equality check would have passed
  if (a === null || b === null) return false;

  // Now are both operands both arrays? Iterate and compare.
  if (a instanceof Array && b instanceof Array) {
    if (a.length != b.length) return false; // Equal Arrays must be the same length

    for (var index = 0; index < a.length; index++)
      if (!equal(a[index], b[index])) return false;

    return true;
  }

  // Finally, compare non-null, non-Array Objects.
  if (a instanceof Object && b instanceof Object) {
    // Do both Objects have the keys?
    if (!equal(Object.keys(a), Object.keys(b))) return false;

    // Do both Objects have the same values?
    for (var key in a)
      if (!equal(a[key], b[key])) return false;

      // Yup.
    return true;
  }

  return false;
}
exports.equal = equal;
