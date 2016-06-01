/* global Log, Config */
'use strict';

const EventEmitter = require('events').EventEmitter;
const deepDiff = require('deep-diff').diff;

/**
 * Check to if the given value is mergeable.
 *
 * @param {*} value
 *
 * @return {Boolean}  Returns true if the object can be merged, false otherwise.
 */
function canMerge(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if the given value will overwrite other values during a merge.
 *
 * @param {*} value
 *
 * @return {Boolean} Returns true if the value will overwrite others, false otherwise.
 */
function canOverwriteWith(value) {
  return value !== null && value !== undefined && !(value instanceof Function);
}

/**
 * Perform a deep merge of objects based on key.
 * Warning! Destination is modified in place.
 *
 * @param {Object} source       Object from which keys are copied out of
 * @param {Object} destination  Object from which keys are copied into
 */
function merge(source, destination) {
  if (canMerge(source)) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const sourceValue = source[key];
        const destinationValue = destination[key];

        if (canOverwriteWith(sourceValue)) {
          if (canMerge(sourceValue) && canMerge(destinationValue)) {
            merge(sourceValue, destinationValue);
          } else {
            destination[key] = sourceValue; // eslint-disable-line no-param-reassign
          }
        }
      }
    }
  } else if (canOverwriteWith(source)) {
    destination = source; // eslint-disable-line no-param-reassign
  }
}

class Storage extends EventEmitter {
  /**
   * The storage engine maintains a merged set of properties retrieved from
   * source plugins.
   */
  constructor() {
    super();

    this.properties = Object.create(null);
    this.sources = [];
  }

  /**
   * Update cached properties by merging values from source plugins.
   */
  update() {
    this.emit('rebuilding');

    const properties = Object.create(null);

    this.sources.forEach((source) => {
      merge(source.properties, properties);
    });

    // Logging to determine the extent of the update
    const diff = deepDiff(this.properties, properties);

    if (diff) {
      Log.VERBOSE('Calculated storage properties diff during update', {sourceName: 'diff', diff});
    }

    this.properties = properties;

    this.emit('rebuilding-complete');
  }

  /**
   * Remove all source plugins from storage
   */
  clear() {
    let i = this.sources.length;

    while (i--) {
      this.unregister(this.sources[i]);
    }
  }

  /**
   * Un-register a named source plugin
   * @param {Object} plugin
   */
  unregister(plugin) {
    if (plugin.shutdown instanceof Function) {
      plugin.shutdown();
    }
    const index = this.sources.indexOf(plugin);

    if (index !== -1) {
      this.sources.splice(index, 1);
    }
  }

  /**
   * Register a named source plugin.
   *
   * @param {Object} plugin
   */
  register(plugin) {
    if (canMerge(plugin) && plugin.hasOwnProperty('properties')) {
      this.sources.push(plugin);
    }
  }
}

module.exports = Storage;
