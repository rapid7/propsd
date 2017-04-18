/* global Log, Config */
'use strict';

const EventEmitter = require('events').EventEmitter;
const fs = require('fs');

class FileParser {
  constructor() {
    this.properties = Object.create(null);
  }

  /**
   * Parse the file contents
   * @param {Buffer} data
   */
  update(data) {
    let properties = Object.create(null);

    try {
      properties = JSON.parse(data.toString());
    } catch (e) {
      // We should have an error condition but tbd
    }
    this.properties = properties.properties;
  }
}

class File extends EventEmitter {
  constructor(options) {
    super();
    this.configure(options);

    this.type = 'file';
    this.name = this.path;
    this.properties = Object.create(null);
    this._okay = false;
    this._updated = null;
    this._parser = new FileParser();
    this.service = null;
  }

  /**
   * Configures the file plugin
   *
   * The following options are valid:
   * - path (String) The path to the file
   *
   * @param {Object} options Options that can be set for the plugin
   */
  configure(options) {
    const params = options || Object.create(null);

    if (!params.path) {
      throw new Error('No path supplied');
    }

    try {
      fs.accessSync(params.path, fs.R_OK);
      this.path = params.path;
    } catch (err) {
      this._error(err);
      throw err;
    }
  }

  /**
   * Clear the underlying properties object
   */
  clear() {
    this.properties = Object.create(null);
  }

  initialize() {
    if (this.service) {
      return;
    }

    this._update(this.path);

    this.service = fs.watch(this.path, {persistent: true, recursive: false}, () => {
      this._update();
    });

    this._okay = true;
    this.emit('startup');
  }

  /**
   * Stop watching the file for changes
   *
   * @returns {File}
   */
  shutdown() {
    if (!this.service) {
      return this;
    }

    // Release the FSWatcher handle
    this.service.close();

    delete this.service;

    this._okay = false;
    this.emit('shutdown');
    return this;
  }

  /**
   * Return an object describing the file plugin's current status
   *
   * @return {Object}
   */
  status() {
    return {
      ok: this._okay,
      updated: this._updated,
      running: this._running
    };
  }

  /**
   * Check the status of the file watcher
   *
   * @return {Boolean} True if the FSWatcher is set
   * @private
   */
  get _running() {
    return !!this.service;
  }

  /**
   * Updates the properties from the watched file
   * @private
   */
  _update() {
    fs.readFile(this.path, (err, data) => {
      if (err) {
        this._error(err);
        return;
      }

      this._parser.update(data);
      this.properties = this._parser.properties;
      this.emit('update', this);
    });
  }

  /**
   * Generic handler for all errors
   *
   * @param {Error} error
   * @private
   */
  _error(error) {
    this._okay = false;

    Log.error(error, {
      source: this.name,
      type: this.type
    });

    if (this.listeners('error').length > 0) {
      this.emit('error', error);
    }
  }
}

module.exports = File;
