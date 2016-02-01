var EventEmitter = require('events').EventEmitter;
var Extendable = require('../util/extendable');

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
var Source = module.exports = function(Parser, options, update) {
  options = options || {};
  EventEmitter.call(this);

  this.parser = new Parser(options);
  this.name = options.name || 'source';
  this.updated = null;

  this.configure(options);

  // Register an update handsler
  if (update instanceof Function) this.on('update', update);
};

Extendable.inherits(Source, EventEmitter);
Extendable.mixin(Source);

// Add getter-helpers for type and parser parameters
Object.defineProperties(Source.prototype, {
  type: {
    enumerable: true,
    get: function() {
      return this.constructor.type;
    }
  },
  properties: {
    enumerable: true,
    get: function() {
      return this.parser.properties;
    }
  },
  sources: {
    enumerable: true,
    get: function() {
      return this.parser.sources;
    }
  },
  _sources: {
    enumerable: false,
    get: function() {
      return this.parser._sources;
    }
  }
});

Source.handlers = {};

/**
 * Register a source plugin
 *
 * @param  {Source} resource Plugin module
 * @return {Void}
 */
Source.register = function(resource) {
  Log.info('Registering source plugin ' + resource.type);
  Source.handlers[resource.type] = resource;
};

/**
 * Optional interface to reconfigure a source
 *
 * @return {Boolean} Returns true when a configuration change occures
 */
Source.prototype.configure = function() {
  return false;
};

/**
 * Called by implementations to update source data
 *
 * @private
 *
 * @param {Buffer}  data  Updated data from an implementation-specific source
 * @return {Void}
 */
Source.prototype._update = function(data) {
  this.parser.update(data);
  this.updated = new Date();

  Log.info('Updated source ' + this.name, {
    source: this.name,
    type: this.type
  });
  this.emit('update');
};

/**
 * Handle errors from underlying source facilities
 *
 * @emits {Error} error If any listeners have been registered
 *
 * @param  {Error} err An instance of Error
 * @return {Void}
 */
Source.prototype._error = function(err) {
  Log.error(err, {
    source: this.name,
    type: this.type
  });

  // Only emit an error event if there are listeners.
  if (this.listeners('error').length > 0) this.emit('error', err);
};

/**
 * Optional interface to start a stateful Source
 *
 * @return {Source} Reference to self
 */
Source.prototype.initialize = function(ready) {
  // Register a handler on the first successful update
  if (ready instanceof Function) this.once('update', ready);
  Log.info('Initializing ' + this.type + ' source ' + this.name, {
    source: this.name,
    type: this.type
  });

  return this;
};

/**
 * Optional interface to shutdown a stateful Source
 *
 * @return {Source} Reference to self
 */
Source.prototype.shutdown = function() {
  Log.info('Shutting down ' + this.type + ' source ' + this.name, {
    source: this.name,
    type: this.type
  });

  return this;
};

/**
 * Return an object describing the souce-instance's current status
 *
 * @return {Object}
 */
Source.prototype.status = function() {
  return {
    ok: true, // TODO Check something?!
    updated: this.updated
  };
};

/**
 * Helper method to detect parameter changes
 *
 * @return {Boolean} True if the parameter has been updated
 */
Source.setIfChanged = function(scope, key, value) {
  if (scope[key] == value) return false;

  scope[key] = value;
  return true;
};

Source.Polling = require('./polling');
Source.Consul = require('./consul');
Source.Metadata = require('./metadata');
Source.S3 = require('./s3');
