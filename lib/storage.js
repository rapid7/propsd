'use strict';

const EventEmitter = require('events');
const UPDATE_TIMEOUT_MS = 500;

/**
 * Perform a deep merge of objects based on key.
 * Warning! Destination is modified in place.
 *
 * @param {Object} source       Object from which keys are copied out of
 * @param {Object} destination  Object from which keys are copied into
 *
 * @return {Object}             Reference to destination
 */
function merge(source, destination) {
  if (source instanceof Array && destination instanceof Array) {
    return destination.concat(source);
  }

  // We're deep merging objects in place, so reassignment is expected.
  /* eslint-disable no-param-reassign */
  if (source instanceof Object) {
    Object.keys(source).forEach((key) => {
      if (source[key] !== null && !(source[key] instanceof Function) && source[key] instanceof Object) {
        if (!destination[key] || destination[key].constructor !== source[key].constructor) {
          destination[key] = new (source[key].constructor)();
        }
        destination[key] = merge(source[key], destination[key]);
      } else {
        destination[key] = source[key];
      }
    });
  }

  /* eslint-enable no-param-reassign */
  return destination;
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
