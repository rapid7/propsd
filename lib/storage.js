'use strict';

class Storage {
  /**
   * The storage engine maintains a deep merged set of properties retrived from
   * the registered plugins.
   */
  constructor() {
    this.properties = {};
  }
}

module.exports = Storage;
