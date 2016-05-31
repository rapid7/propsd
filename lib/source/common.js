/* global Log, Config */
'use strict';

const EventEmitter = require('events').EventEmitter;
const DEFAULT_INTERVAL = 60000;

const deepDiff = require('deep-diff').diff;

const Source = (Parser) => class extends EventEmitter {
  constructor(options) {
    super();

    this._parser = options.parser || new Parser(options);

    this.type = options.type;
    this.name = options.name || options.type;
    this.namespace = options.namespace;
    this.interval = Number(options.interval) || DEFAULT_INTERVAL;

    this.state = Source.CREATED;

    this._updated = null;
    this.properties = {};
  }

  /**
   * Initialize a source in state:CREATED
   *
   * @return {Promise<Source>} Promise that resolves with this instance
   *                           when the source has successfully fetched data
   */
  initialize() {
    if (this.state !== Source.CREATED) {
      return Promise.resolve(this);
    }

    // Resolve a promise on the first update event.
    const promise = new Promise((resolve) => this.once('initialized', resolve));

    this.state = Source.INITIALIZING;

    // TODO These events are not necessary
    this.emit('init');
    this.emit('startup');

    this.start();

    return promise;
  }

  /**
   * Shutdown a running source
   *
   * @returns {Source}
   */
  shutdown() {
    if (this.state === Source.SHUTDOWN) {
      return this;
    }

    this.stop();

    this.state = Source.SHUTDOWN;
    this.emit('shutdown');

    return this;
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

    Log.info(`Starting ${this.type} source ${this.name} polling`, {
      source: this.name, type: this.type});

    /**
     * Crete a polling loop around setTimeout. This allows the interval to be changed
     * without stopping the loop, and also allows us to inject exit points where we
     * want them for clean shutdown behavior.
     */
    setImmediate(function poll() {
      const timer = Date.now();

      Log.debug(`Polling source ${this.name} for updates`, {
        source: this.name, type: this.type});

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

        Log.debug(`Polled source ${this.name} in ${(Date.now() - timer)}ms`, {
          source: this.name, type: this.type});

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

    Log.info(`Stopping ${this.type} source ${this.name} polling`, {
      source: this.name, type: this.type});

    clearTimeout(this._timer);
    delete this._timer;

    return this;
  }

  /**
   * Return an object describing the source-instance's current status
   *
   * @return {Object}
   */
  status() {
    return {
      ok: this.ok,
      state: this.state,
      updated: this._updated,
      interval: this.interval
    };
  }

  /**
   * OK States are anything but ERROR or WARNING
   */
  get ok() {
    return this.state !== Source.ERROR && this.state !== Source.WARNING;
  }

  /**
   * Called by implementations to update source data
   *
   * @param {Buffer}  data  Updated data from an implementation-specific source
   * @return {Source} Reference to Source instance
   * @private
   */
  _update(data) {
    // No changes to the source's data have occurred since the last update
    if (data === Source.NO_UPDATE) {
      Log.debug(`Source ${this.name} is up to date`, {
        source: this.name, type: this.type});

      // TODO Unnecessary event
      this.emit('no-update');

      return this;
    }

    // The source's underlying data resource does not exist
    if (data === Source.NO_EXIST) {
      switch (this.state) {
        case Source.INITIALIZING:
          this.state = Source.WAITING;

          // Resolve the initialize promise
          this.emit('initialized', this);
          return this;

        case Source.RUNNING:
          this.state = Source.WAITING;

          // Clear previous properties
          this.properties = {};
          this._updated = new Date();

          // Notify watchers
          this.emit('update', this);
          return this;

        case Source.WARNING:
        case Source.ERROR:

          // There was some kind of a successful response. Not an ERROR
          // or WARNING anymore.
          this.state = Source.WAITING;
          return this;

        default:
          return this;
      }
    }

    try {
      this._parser.update(data);
    } catch (e) {
      return this._error(e);
    }

    // Resolve the initialize promise
    if (this.state === Source.INITIALIZING) {
      this.emit('initialized', this);
    }

    // Successful update indicates a RUNNING state
    this.state = Source.RUNNING;
    this._updated = new Date();

    // Logging to determine the extent of the update
    const diff = deepDiff(this.properties, this._parser.properties);

    if (diff) {
      Log.verbose(`Calculated ${this.name} properties diff during update`, {diff});
    }

    this.properties = this._parser.properties;

    this.emit('update', this);
    return this;
  }

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
    this.state = Source.ERROR;

    Log.error(err, {source: this.name, type: this.type});

    // Only emit an error event if there are listeners.
    if (this.listeners('error').length > 0) {
      this.emit('error', err);
    }

    return this;
  }
};

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

module.exports = Source;
