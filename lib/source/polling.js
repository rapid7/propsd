'use strict';

var Source = require('./index');

/**
 * Abstract parent for polled sources
 *
 * @abstract
 * @class Source.Polling
 *
 * @extends Source
 */
class Polling extends Source {
  configure(params) {
    var changed = super.configure(params);
    changed = Polling.setIfChanged(this, 'interval', params.interval || 60 * 1000) || changed; // Default 1m

    return changed;
  }

  /**
   * Called by interval to fetch source data.
   *
   * @private
   * @abstract
   *
   * @param {Function}  callback({Error} error, {Buffer} data)  Called after a
   *                                     polling operation. `data` may be `false`,
   *                                     indicating that no change has occured, as
   *                                     observed by the implementation.
   * @return {Void}
   */
  _fetch(callback) {
    throw ReferenceError('Method _fetch must be implemented!');
  }

  /**
   * Start the polling interval loop
   *
   * @return {Polling} Receiver
   */
  initialize(ready) {
    if (this._interval) return this;
    super.initialize(ready);

    var _this = this;
    this._interval = true; // Initialize state to 'RUNNING'

    (function poll() {
      var timer = Date.now();
      Log.debug('Polling source ' + _this.name + ' for updates', {
        source: _this.name,
        type: _this.type
      });

      _this._fetch(function(err, data) {
        // If `shutdown()` was called _during_ a fetch operation, `clearTimeout()`
        // will have no effect. Instead, we overload `_interval` as a state to detect
        // if a shutdown has been initiated. Flasey -> don't set another timeout.
        if (_this.running) _this._interval = setTimeout(poll, _this.interval);
        if (err) return _this._error(err);

        Log.debug('Polled source ' + _this.name + ' in ' + (Date.now() - timer) + 'ms', {
          source: _this.name,
          type: _this.type
        });

        if (data) return _this._update(data);

        Log.debug('Source ' + _this.name + ' is up to date', {
          source: _this.name,
          type: _this.type
        });
      });

      // Start the polling loop
    })();

    return this;
  }

  /**
   * Stop the polling interval loop
   *
   * @return {Polling} Receiver
   */
  shutdown() {
    super.shutdown();

    clearTimeout(this._interval);
    delete this._interval;

    return this;
  }

  /**
   * Check the status of the polling interval loop
   *
   * @return {Boolean} True if the pooling loop is running
   */
  get running() {
    return !!this._interval;
  }

  /**
   * Return an object describing the souce-instance's current status
   *
   * @return {Object}
   */
  status() {
    var output = super.status();

    output.interval = this.interval;
    output.running = this.running;

    return output;
  }
}


/* Exports */
module.exports = Polling;
