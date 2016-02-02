'use strict';

var EventEmitter = require('events').EventEmitter;

/**
 * Abstract parent for Source implementations
 *
 * @abstract
 * @class Source
 * @extends EventEmitter
 * @extends Extendable
 *
 * @param {Parser} parser  An instance of a Parser
 * @param {Object} options A hash of configuration options
 */
class Source extends EventEmitter {
  constructor(Parser, options, update) {
    options = options || {};
    super()

    this.parser = new Parser(this, options);
    this.name = options.name || 'source';

    this.ok = false;
    this.updated = null;

    this.configure(options);

    // Register an update handsler
    if (update instanceof Function) this.on('update', update);
  }

  get type() {
    return this.constructor.type;
  }

  get properties() {
    return this.parser.properties;
  }

  get sources() {
    return this.parser.sources;
  }

  get _sources() {
    return this.parser._sources;
  }

  /**
   * Register a source plugin
   *
   * @param  {Source} resource Plugin module
   * @return {Void}
   */
  static register(resource) {
    Log.info('Registering source plugin ' + resource.type);
    Source.handlers[resource.type] = resource;
  }

  /**
   * Optional interface to reconfigure a source
   *
   * @return {Boolean} Returns true when a configuration change occures
   */
  configure() {
    return false;
  }

  /**
   * Called by implementations to update source data
   *
   * @private
   *
   * @param {Buffer}  data  Updated data from an implementation-specific source
   * @return {Void}
   */
  _update(data) {
    this.parser.update(data);
    this.updated = new Date();
    this.ok = true;

    Log.info('Updated source ' + this.name, {
      source: this.name,
      type: this.type
    });
    this.emit('update');
  }

  /**
   * Handle errors from underlying source facilities
   *
   * @emits {Error} error If any listeners have been registered
   *
   * @param  {Error} err An instance of Error
   * @return {Void}
   */
  _error(err) {
    this.ok = false;
    Log.error(err, {
      source: this.name,
      type: this.type
    });

    // Only emit an error event if there are listeners.
    if (this.listeners('error').length > 0) this.emit('error', err);
  }

  /**
   * Optional interface to start a stateful Source
   *
   * @return {Source} Reference to self
   */
  initialize(ready) {
    // Register a handler on the first successful update
    if (ready instanceof Function) this.once('update', ready);

    Log.info('Initializing ' + this.type + ' source ' + this.name, {
      source: this.name,
      type: this.type
    });

    return this;
  }

  /**
   * Optional interface to shutdown a stateful Source
   *
   * @return {Source} Reference to self
   */
  shutdown() {
    Log.info('Shutting down ' + this.type + ' source ' + this.name, {
      source: this.name,
      type: this.type
    });

    return this;
  }

  /**
   * Return an object describing the souce-instance's current status
   *
   * @return {Object}
   */
  status() {
    return {
      ok: this.ok,
      updated: this.updated
    };
  }

  /**
   * Helper method to detect parameter changes
   *
   * @return {Boolean} True if the parameter has been updated
   */
  static setIfChanged(scope, key, value) {
    if (scope[key] == value) return false;

    scope[key] = value;
    return true;
  }
}

Source.handlers = {};

module.exports = Source;
Source.Polling = require('./polling');
