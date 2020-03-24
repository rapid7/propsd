'use strict';

const EventEmitter = require('events').EventEmitter;

/**
 * Base class for all Source-types
 *
 * @class Source
 * @extends EventEmitter
 */
class Source extends EventEmitter {
  /**
   * Constructor
   * @param {String} name
   * @param {Object} options
   */
  constructor(name, options) {
    super();

    if (!name) {
      throw new ReferenceError('Source/Common: Sources must have a `name` parameter!');
    }

    this.parser = options.parser;
    this._state = null;

    this.name = name;
    this.state = Source.CREATED;
    this.updated = null;

    this.properties = {};
    this.sources = [];
  }

  /**
   * Get the Source type
   * @return {string}
   */
  get type() {
    return this.constructor.name.toLowerCase();
  }

  /**
   * Initialize a source in state:CREATED
   *
   * @return {Promise<Source>} Promise that resolves with this instance
   *                           when the source has successfully fetched data
   */
  initialize() {
    // A source can only be initialized from the CREATED state
    if (this.state !== Source.CREATED) {
      if (this.state !== Source.INITIALIZING) {
        return Promise.resolve(this);
      }

      return new Promise((resolve) => this.once('initialized', resolve));
    }

    this.state = Source.INITIALIZING;
    Log.log('DEBUG', `Initializing ${this.type} source ${this.name}`, this.status());
    this.once('initialized', () => {
      Log.log('DEBUG', `Initialized ${this.type} source ${this.name}`, this.status());
    });

    // Resolve a promise when the source transitions out of the INITIALIZING state
    return new Promise((resolve) => this.once('initialized', resolve));
  }

  /**
   * Shutdown a running source
   *
   * @returns {Source}
   */
  shutdown() {
    const previousState = this.state;

    if (this.state === Source.SHUTDOWN) {
      return this;
    }
    this.state = Source.SHUTDOWN;

    this.properties = {};
    this._state = null;

    /**
     * Resolve the initialize promise.
     *
     * It's OK that the source is going to transition strait to shutdown. We've
     * set its properties to an empty object, and it will never emit an update event.
     * This means that it will never effect a parent view/property set, and should
     * eventually get cleaned up.
     */
    if (previousState === Source.INITIALIZING) {
      this.emit('initialized', this);
    }

    Log.log('INFO', `Shutting down ${this.type} source ${this.name}`, this.status());
    this.emit('shutdown', this);

    return this;
  }

  /**
   * Return an object describing the source-instance's current status
   *
   * @return {Object}
   */
  status() {
    return {
      name: this.name,
      type: this.type,
      ok: this.ok,
      state: this.state,
      updated: this.updated
    };
  }

  /**
   * OK States are anything but ERROR or WARNING
   */
  get ok() {
    return this.state !== Source.ERROR && this.state !== Source.WARNING;
  }

  /**
   * Ready States are anything but INITIALIZED or CREATED
   */
  get ready() {
    return this.state !== Source.INITIALIZING && this.state !== Source.CREATED;
  }

  /* eslint-disable max-statements */

  /**
   * Called by implementations to update source data
   *
   * @param {Buffer}  data  Updated data from an implementation-specific source
   * @return {Source} Reference to Source instance
   * @private
   */
  _update(data) {
    const previousState = this.state;

    // No changes to the source's data have occurred since the last update
    if (data === Source.NO_UPDATE) {
      this.emit('noupdate', this);

      return this;
    }

    // The source's underlying data resource does not exist
    if (data === Source.NO_EXIST) {
      this.state = Source.WAITING;

      // Clear previous properties and state
      this.properties = {};
      this._state = null;
      this.updated = new Date();

      // Resolve the initialize promise
      if (previousState === Source.INITIALIZING) {
        this.emit('initialized', this);
      }

      // Emit an update if the source no longer exists
      if (previousState !== Source.WAITING) {
        Log.log('INFO', `Source ${this.type} source ${this.name} no longer exists`, this.status());
        this.emit('update', this);
      }

      return this;
    }

    try {
      this.parser.update(data);
    } catch (e) {
      return this._error(e);
    }

    // Successful update indicates a RUNNING state
    this.state = Source.RUNNING;
    this.updated = new Date();

    // Resolve the initialize promise
    if (previousState === Source.INITIALIZING) {
      this.emit('initialized', this);
    }

    // Expose hard references to the last-known-good properties and sources
    // objects generated by the parser. Even if the updates or parsing start to fail
    // in the future, these values will be available to the Properties/Sources instances.
    this.properties = this.parser.properties;
    this.sources = this.parser.sources;

    Log.log('INFO', `Updated ${this.type} source ${this.name}`, this.status());
    this.emit('update', this);

    return this;
  }

  /* eslint-enable max-statements */

  /**
   * Handle errors from underlying source facilities
   *
   * @emits {Error} error If any listeners have been registered
   *
   * @param  {Error} err An instance of Error
   * @return {Metadata} Reference to instance
   * @private
   */
  _error(err) {
    const previousState = this.state;

    this.state = Source.ERROR;
    this._state = null;

    // Resolve the initialize promise
    if (previousState === Source.INITIALIZING) {
      this.emit('initialized', this);
    }

    Log.log('ERROR', err, this.status());

    // Only emit an error event if there are listeners.
    if (this.listeners('error').length > 0) {
      this.emit('error', err, this);
    }

    return this;
  }
}

// Non-data responses from provider resources
Source.NO_UPDATE = 'NO_UPDATE';
Source.NO_EXIST = 'NO_EXIST';

// Lifecycle states
Source.CREATED = 'CREATED';
Source.INITIALIZING = 'INITIALIZING';
Source.WAITING = 'WAITING';
Source.RUNNING = 'RUNNING';
Source.SHUTDOWN = 'SHUTDOWN';

// Error States
Source.WARNING = 'WARNING';
Source.ERROR = 'ERROR';

/**
 * Build a Mixin class to inject a Parser class into a Source
 *
 * @param  {Class} Parser A Parser class to inject into the child class
 * @return {Class}
 */
const Factory = module.exports = function Factory(Parser) {
  return class extends Source {
    /**
     * Constructor
     * @param {String} name
     * @param {Object} options
     */
    constructor(name, options) {
      super(name, Object.assign({
        parser: new Parser()
      }, options));
    }
  };
};

// Make `instanceof` work on the exported Factory reference
Factory.prototype = Source.prototype;

// Export constants from the Source class
Object.setPrototypeOf(Factory, Source);
Factory.Class = Source;

/**
 * Polling sub-class for Sources that need to retrieve data every n seconds
 *
 * @class Polling
 * @extends Source
 */
class Polling extends Source {
  /**
   * Constructor
   * @param {String} name
   * @param {Object} options
   */
  constructor(name, options) {
    super(name, options);

    this.interval = Number(options.interval) || Polling.DEFAULT_INTERVAL;
  }

  /**
   * Initialize the polling process
   *
   * @return {Promise.<Source>}
   */
  initialize() {
    const promise = super.initialize();

    this.start();

    return promise;
  }

  /**
   * Shutdown the polling process
   *
   * @return {Source}
   */
  shutdown() {
    this.stop();

    return super.shutdown();
  }

  /**
   * Start a polling interval loop
   *
   * @returns {Source}
   */
  start() {
    if (this._timer) {
      return this;
    }
    this._timer = true;

    /**
     * Crete a polling loop around setTimeout. This allows the interval to be changed
     * without stopping the loop, and also allows us to inject exit points where we
     * want them for clean shutdown behavior.
     */
    setImmediate(function poll() {
      Log.log('DEBUG', `Polling ${this.type} source ${this.name} for updates`, this.status());
      const timer = Date.now();

      this._fetch((err, data) => {
        if (!this._timer) {
          // If `stop()` was called _during_ a fetch operation, `clearTimeout()`
          // will have no effect. Instead, we overload `_timer` as a state to detect
          // if the loop should be stopped. False-y -> don't set another timeout.
          return;
        }

        // Schedule the next execution, regardless of errors.
        this._timer = setTimeout(poll.bind(this), this.interval);

        if (err) {
          return this._error(err); // eslint-disable-line consistent-return
        }

        Log.log('DEBUG', `Polled ${this.type} source ${this.name} in ${(Date.now() - timer)}ms`, this.status());
        this._update(data);
      });
    }.bind(this));

    return this;
  }

  /**
   * Stop the polling interval loop
   *
   * @return {Source}
   */
  stop() {
    if (!this._timer) {
      return this;
    }

    clearTimeout(this._timer);
    delete this._timer;

    return this;
  }

  /**
   * Get the Source status
   * @return {{name, type, ok, state, updated}|*}
   */
  status() {
    const object = super.status();

    object.interval = this.interval;

    return object;
  }
}

Polling.DEFAULT_INTERVAL = 60000;

/**
 * Build a Mixin class to inject a Parser class into a Polling Source
 *
 * @param  {Class} Parser A Parser class to inject into the child class
 * @return {Class}
 */
const PollingFactory = Source.Polling = function PollingFactory(Parser) {
  return class extends Polling {
    /**
     * Constructor
     * @param {String} name
     * @param {Object} options
     */
    constructor(name, options) {
      super(name, Object.assign({
        parser: new Parser()
      }, options));
    }
  };
};

// Make `instanceof` work on the exported PollingFactory reference
PollingFactory.prototype = Polling.prototype;

// Export constants from the Polling class
Object.setPrototypeOf(PollingFactory, Polling);
PollingFactory.Class = Polling;
