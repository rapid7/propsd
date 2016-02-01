import Agent from './agent';
import Parser from './parser';
import EventEmitter from 'events';
import EventBus from './../../utils/events';

/**
 * S3 source bootstrap class
 */
class S3 extends EventEmitter {
  /**
   * @callback S3~Callback
   * @param options {Object}
   */

  /**
   * @param bucket {string}
   * @param path {string}
   * @param interval {int}
   */
  constructor(bucket, path, interval) {
    super();

    this._bucket = bucket;
    this._path = path;
    this._interval = interval;

    this._store = {};
    this._agent = new Agent(this._bucket, this._path);
    this._status = 'OK';

    this.on('error', (e) => {
      this._status = 'ERR';
    }).on('done', () => {
      this._status = 'OK';
    });
  }

  /**
   * Get the unique name for this plugin instance
   * @returns {string}
   */
  getName() {
    return `${this.getType().toLowerCase()}-${this._bucket}-${this._path}`;
  }

  /**
   * Get the plugin type
   * @returns {string}
   */
  getType() {
    // ES6 has to support a better way to do class constants...right?
    return 'S3';
  }

  /**
   * @param callback {S3~Callback}
   * @param args {Object}
   */
  fetch(callback = null, args = {}) {
    const cb = (callback instanceof Function) ? callback : () => {
      const eTag = this._store['ETag'] || null;
      const result = this._agent.fetch(eTag); // Promise

      result.then((val) => {
        this._store['ETag'] = val.ETag;

        // Instantiate a `Sources.S3.Parser` and parse the Body from S3
        let parser = new Parser(val.Body);

        this.emit('done', this.getType(), this.getName(), parser.getData());
      })
      .catch((err) => {
        // Emit an error event
        if (err.code !== 'NotModified') {
          this.emit('error', this.getType(), this.getName(), err);
        }
      });
    };

    this._timer = setInterval(cb, this._interval, {
      args: args
    });
  }

  /**
   * Return the status of the plugin (tbd what that means)
   */
  status() {
    return this._status;
  }

  /**
   * Shutdown method
   */
  shutdown() {
    this._timer.clear();
  }
}

export default S3;
