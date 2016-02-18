'use strict';

const EventEmitter = require('events');
const UPDATE_TIMEOUT_MS = 500;

/**
 * Check to if the given value is mergable.
 *
 * @param {*} value
 *
 * @return {Boolean}  Returns true if the object can be merged, false otherwise.
 */
function canMerge(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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

        if (sourceValue !== null && sourceValue !== undefined && !(sourceValue instanceof Function)) {
          if (canMerge(sourceValue) && canMerge(destinationValue)) {
            merge(sourceValue, destinationValue);
          } else {
            destination[key] = sourceValue; // eslint-disable-line no-param-reassign
          }
        }
      }
    }
  } else {
    destination = source; // eslint-disable-line no-param-reassign
  }
}

class Storage {
  /**
   * The storage engine maintains a merged set of properties retrived from
   * source plugins.
   *
   * @param {EventEmitter} emitter
   */
  constructor(emitter) {
    this.sources = [];
    this.properties = {};
    this.emitter = emitter || new EventEmitter();
  }

  /**
   * Update cached properties by merging values from source plugins.
   *
   * @fires Storage#update
   */
  update() {
    if (this.updateTimeout) {
      return;
    }

    this.updateTimeout = setTimeout(() => {
      const properties = Object.create(null);

      this.sources.forEach((source) => {
        merge(source.properties, properties);
      });
      this.properties = properties;

      /**
       * Update event.
       *
       * @event Storage#update
       * @type {object}
       */
      this.emitter.emit('update', properties);

      delete this.updateTimeout;
    }, UPDATE_TIMEOUT_MS);
  }

  /**
   * Register a named source plugin.
   *
   * @param {Object} plugin
   */
  register(plugin) {
    this.sources.push(plugin);
  }
}

module.exports = Storage;
