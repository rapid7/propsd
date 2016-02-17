'use strict';

const EventEmitter = require('events');
const UPDATE_TIMEOUT_MS = 500;

class Storage {
  /**
   * The storage engine maintains a deep merged set of properties retrived from
   * source plugins.
   *
   * @param {EventEmitter} emitter
   */
  constructor(emitter) {
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
}

module.exports = Storage;
