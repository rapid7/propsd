'use strict';

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
   * source plugins. An optional EventEmitter can be provided. When properties
   * change an "update" event will fire on the emitter with the new properites.
   *
   * @param {EventEmitter} emitter
   */
  constructor(emitter) {
    this.properties = {};
    this._sources = [];
    this._emitter = emitter;
  }

  /**
   * Update cached properties by merging values from source plugins.
   *
   * @fires Storage#update
   */
  update() {
    if (this._updateTimeout) {
      return;
    }

    this._updateTimeout = setTimeout(() => {
      const properties = Object.create(null);

      this._sources.forEach((source) => {
        merge(source.properties, properties);
      });
      this.properties = properties;

      /**
       * Update event.
       *
       * @event Storage#update
       * @type {object}
       */
      if (this._emitter) {
        this._emitter.emit('update', properties);
      }

      delete this._updateTimeout;
    }, UPDATE_TIMEOUT_MS);
  }

  /**
   * Register a named source plugin.
   *
   * @param {Object} plugin
   */
  register(plugin) {
    this._sources.push(plugin);
  }
}

module.exports = Storage;
