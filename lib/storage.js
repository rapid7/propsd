'use strict';

const EventEmitter = require('events');

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
    /**
     * Update event.
     *
     * @event Storage#update
     * @type {object}
     */
    const properties = Object.create(null);

    this.properties = properties;
    this.emitter.emit('update', properties);
  }
}

module.exports = Storage;
