'use strict';

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

exports.getNestedProperty = getNestedProperty;
