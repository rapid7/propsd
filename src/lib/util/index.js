'use strict';

const isPlainObject = require('lodash.isplainobject');

/**
 * Recursively index into an object until we get to the end of the queue
 * @param {Object} object
 * @param {Array} queue
 * @return {*}
 */
const getNestedProperty = (object, queue) => {
  if (queue.length === 0) {
    return object;
  }
  const k = queue.shift();

  const prop = object[k];

  if (typeof prop === 'undefined') {
    throw new TypeError(`Key '${k}' does not exist in object ${JSON.stringify(object)}.`);
  }

  return getNestedProperty(prop, queue);
};

/* eslint-disable eqeqeq */
/**
 * Deep-merge one Object into another. Do _not_ deep merge anything that isn't explicitly
 * a first-order instance of Object.
 *
 * @param  {Object} destination   The destination of the merge operation. This object is mutated
 * @param  {Object} source        The source that properties are merged from
 * @return {Object}               The destination object
 */
const merge = (destination, source) => {
  // Ensure that the destination value is an Object.
  const dest = isPlainObject(destination) ? destination : {};

  // Only merge source if it's an Object.
  if (!isPlainObject(source)) {
    return dest;
  }

  Object.keys(source).forEach((key) => {
    // Ignore null and undefined source values. `== null` covers both
    if (source[key] == null) {
      return;
    }

    // Is this an Object (but not something that inherits Object)?
    if (Object.getPrototypeOf(source[key]) === Object.prototype) {
      // Recursively merge source Object into destination
      dest[key] = merge(dest[key], source[key]);

      return;
    }

    dest[key] = source[key];
  });

  return dest;
};
/* eslint-enable eqeqeq */

/**
 * Recursively traverses a layer namespace and sets the value at the corresponding place in the object
 * @param {Object} destination The destination of the merge operation.
 * @param {Array<String>} namespaceArray An array of keys (namespaces) to traverse
 * @param {Object} source The source that properties are merged from
 * @return {Object}
 */
const recusiveNamespaceMerge = (destination, namespaceArray, source) => {
  const nextNamespace = namespaceArray.shift();
  const dest = isPlainObject(destination) ? destination : {};

  if (namespaceArray.length) {
    dest[nextNamespace] = recusiveNamespaceMerge(dest[nextNamespace], namespaceArray, source);

    return dest;
  }

  dest[nextNamespace] = merge(dest[nextNamespace], source);

  return dest;
};

module.exports = {
  getNestedProperty,
  merge,
  recusiveNamespaceMerge
};
