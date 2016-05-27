/* global Log, Config */
'use strict';

const EventEmitter = require('events').EventEmitter;
const DEFAULT_INTERVAL = 60000;

const Source = (Parser) => class extends EventEmitter {
  constructor(options) {
    super();

    this._parser = new Parser(options);

    this.type = options.type;
    this.name = options.name || options.type;
    this.namespace = options.namespace;
    this.interval = Number(options.interval) || DEFAULT_INTERVAL;

    this._ok = false;
    this._updated = null;

    this.properties = {};
  }

  /**
   * Start a polling interval loop
   *
   * @return {Promise<Source>} Promise that resolves with this instance
   *                           when the source has successfully fetched data
   */
  start() {
    if (this._timer) {
      return Promise.resolve(this);
    }

    this.emit('init');
    this.emit('startup');
    Log.info(`Starting ${this.type} source ${this.name} polling`, {
      source: this.name,
      type: this.type
    });

    // Resolve a promise on the first update event.
    const promise = new Promise((resolve) => this.once('update', resolve));

    // Initialize state to 'RUNNING'
    this._timer = true;

    /**
     * Crete a polling loop around setTimeout. This allows the interval to be changed
     * without stopping the loop], and also allows us to inject exit points where we
     * want them for clean shutdown behavior.
     */
    setImmediate(function poll() {
      const timer = Date.now();

      Log.debug(`Polling source ${this.name} for updates`, {
        source: this.name,
        type: this.type
      });

      this._fetch((err, data) => {
        // If `stop()` was called _during_ a fetch operation, `clearTimeout()`
        // will have no effect. Instead, we overload `_interval` as a state to detect
        // if a shutdown has been initiated. False-y -> don't set another timeout.
        if (!this._running) {
          return;
        }

        // Schedule the next execution
        this._timer = setTimeout(poll.bind(this), this.interval);

        if (err) {
          return this._error(err); // eslint-disable-line consistent-return
        }

        Log.debug(`Polled source ${this.name} in ${(Date.now() - timer)}ms`, {
          source: this.name,
          type: this.type
        });

        if (data) {
          return this._update(data); // eslint-disable-line consistent-return
        }

        this.emit('no-update');
        Log.debug(`Source ${this.name} is up to date`, {
          source: this.name,
          type: this.type
        });
      });

      // Start the polling loop
    }.bind(this));

    return promise;
  }

  /**
   * Stop the polling interval loop
   *
   * @return {Source} Receiver
   */
  stop() {
    if (!this._running) {
      return this;
    }

    Log.info(`Stopping down ${this.type} source ${this.name} polling`, {
      source: this.name,
      type: this.type
    });

    clearTimeout(this._timer);
    delete this._timer;

    this.emit('shutdown');
    return this;
  }

  /**
   * Check the status of the polling interval loop
   *
   * @return {Boolean} True if the pooling loop is running
   */
  get _running() {
    return !!this._timer;
  }

  /**
   * Called by implementations to update source data
   *
   * @param {Buffer}  data  Updated data from an implementation-specific source
   * @return {Source} Reference to Source instance
   * @private
   */
  _update(data) {
    this._parser.update(data);

    this._updated = new Date();
    this._ok = true;

    this.properties = this._parser.properties;

    Log.info(`Updated source ${this.name}`, {
      source: this.name,
      type: this.type
    });
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
    this._ok = false;

    Log.error(err, {
      source: this.name,
      type: this.type
    });

    // Only emit an error event if there are listeners.
    if (this.listeners('error').length > 0) {
      this.emit('error', err);
    }

    return this;
  }
};

module.exports = Source;
