import Store from './store';
import Agent from './agent';
import Parser from './parser';
import EventBus from './../../utils/events';

/**
 * S3 source bootstrap class
 */
class S3 {
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
    this._bucket = bucket;
    this._path = path;
    this._interval = interval;

    this._store = new Store();
    this._agent = new Agent(this._bucket, this._path);
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
    const cb = (callback instanceof Function) ? callback : this.defaultFetch;
    this._timer = setInterval(cb, this._interval, {
      args: args,
      agent: this._agent,
      store: this._store,
      source: {
        name: this.getName(),
        type: this.getType()
      }
    });
  }

  /**
   * Default callback for `fetch()` if one isn't provided
   * @param options
   */
  defaultFetch(options) {
    const agent = options.agent;
    const store = options.store;
    const source = options.source;

    const eTag = store.get('ETag') || null;
    const result = agent.fetch(eTag); // Promise

    result.then((val) => {
      store.set('ETag', val.ETag);

      // Instantiate a `Sources.S3.Parser` and parse the Body from S3
      let parser = new Parser(val.Body);
        EventBus.emit('source-done', source.type, source.name, parser.getData());
    })
    .catch((err) => {
      // Emit an error event
      if (err.code !== 'NotModified') {
        EventBus.emit('source-err', source.type, source.name, err);
      }
    });
  }

  /**
   * Return the status of the plugin (tbd what that means)
   */
  status() {

  }

  /**
   * Shutdown method
   */
  shutdown() {
    this._timer.clear();
  }
}

export default S3;
