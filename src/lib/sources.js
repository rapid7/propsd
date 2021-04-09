'use strict';

const EventEmitter = require('events').EventEmitter;
const STATUS_CODES = require('./util/status-codes');

const Comparator = require('./sources/comparator');
const Index = require('./sources/iindex');

/**
 * A coordinating class that makes sure that Properties are resolved before
 * attempting to retrieve the Index. When the Index (or its underlying sources)
 * update, have Properties rebuild the view.
 *
 * @class Sources
 * @extends EventEmitter
 */
class Sources extends EventEmitter {
  /**
   * Constructor
   * @param {Properties} properties
   */
  constructor(properties) {
    super();

    this.setMaxListeners(Sources.MAX_LISTENERS);

    this.properties = properties;
    this.indices = [];

    this.initialized = false;
    this.current = new Index([], null);
  }

  /**
   * Add an index document source
   *
   * @param  {Source} source
   */
  addIndex(source) {
    this.indices.push(source);
  }

  /**
   * Initialize the Properties instance, then all of the index sources, then
   * trigger the first update, then subscribe to future update events.
   *
   * @return {Promise<Sources>}
   */
  initialize() {
    // Instance is already initialized
    if (this.initialized) {
      return Promise.resolve(this);
    }

    // Resource is currently initializing. Resolve on initialized
    if (this.initializing) {
      return new Promise((resolve) => {
        this.once('initialized', () => resolve(this));
      });
    }

    // Resource is not yet initialized. Start initializing
    this.initializing = true;

    return this.properties.initialize()
      .then(() => Promise.all(
        this.indices.map((source) => source.initialize())
      ))
      .then(() => this.update())
      .then(() => {
        // Subscribe to indices' update events
        this.indices.forEach((source) =>
          source.on('update', () => this.update()));

        // Subscribe to properties' build events once it's initialized
        this.properties.on('build', () => this.update());

        this.initializing = false;
        this.initialized = true;
        this.emit('initialized', this);

        return this;
      });
  }

  /**
   * Create a new Index, instantiate new sources, create and activate a new view,
   * then shutdown retired sources
   *
   * @return {Promise<Sources>}
   */
  update() {
    const updated = new Promise((resolve) => {
      this.once('_resolve_update', () => resolve(this));
    });

    if (this._updating) {
      return updated;
    }

    Log.log('INFO', 'Sources: Updating sources');

    // Block for a hold-down period to let multiple updates propagate
    this._updating = setTimeout(() => {
      let configs = [];

      // Aggregate Source configurations from index sources
      this.indices.forEach((source) => {
        if (!(source.sources instanceof Array)) {
          Log.log('WARN', `Sources: Index source ${source.name} does not have any sources. Ignoring.`);

          return;
        }

        configs = configs.concat(source.sources);
      });

      const next = new Index(configs, this.properties.persistent);
      const difference = Comparator.compare(this.current, next);

      this.current = difference.build(Sources.providers);

      // Nothing to see here. Don't trigger a view-update.
      if (!difference.changes) {
        delete this._updating;

        Log.log('INFO', 'Sources: Update successful, no changes.');
        this.emit('_resolve_update', this);
        this.emit('noupdate', this);

        return;
      }

      // Build and activate a new view from the new Index, then clean up old sources.
      this.properties.view(next.ordered()).activate()
        .then(() => {
          difference.cleanup();
          delete this._updating;

          Log.log('INFO', `Update successful, created ${difference.create.length} sources, ` +
              `shutting down ${difference.destroy.length} sources`);

          this.emit('_resolve_update', this);
          this.emit('update', this);
        });
    }, Sources.UPDATE_HOLD_DOWN);

    return updated;
  }

  /**
   * Compute system status
   *
   * @return {Object}
   */
  health() {
    const obj = {
      code: STATUS_CODES.OK,
      status: 'OK',
      indices: this.indices.map((i) => i.status()),
      sources: this.properties.sources.map((s) => s.status())
    };

    // Health logic:
    // Indices:
    // 500 - any index is !ok
    // 503 - any index is !ready
    // 200 - all indices are both ok and ready
    // Sources:
    // 500 - all sources are !ok
    // 503 - any source is !ready
    // 200 - all sources both ok and ready
    //
    const notReady = (s) => !s.ready;
    const unhealthy = (s) => !s.ok;

    if (this.indices.some(unhealthy)) {
      const u = this.indices.find((i) => !i.ok);

      obj.code = STATUS_CODES.INTERNAL_SERVER_ERROR;
      obj.status = u.status().state;

      return obj;
    }

    if (this.indices.some(notReady)) {
      const u = this.indices.find((i) => !i.ready);

      obj.code = STATUS_CODES.SERVICE_UNAVAILABLE;
      obj.status = u.status().state;

      return obj;
    }

    if (this.properties.sources.length > 0 && this.properties.sources.every(unhealthy)) {
      const u = this.properties.sources.find((s) => !s.ok);

      obj.code = STATUS_CODES.INTERNAL_SERVER_ERROR;
      obj.status = u.status().state;

      return obj;
    }

    if (this.properties.sources.some(notReady)) {
      const u = this.properties.sources.find((s) => !s.ready);

      obj.code = STATUS_CODES.SERVICE_UNAVAILABLE;
      obj.status = u.status().state;

      return obj;
    }

    return obj;
  }
}

// Registered Source providers
Sources.providers = {
  s3: require('./source/s3'),
  consul: require('./source/consul')
};

// Update hold-down timeout
Sources.UPDATE_HOLD_DOWN = 1000;
Sources.MAX_LISTENERS = 100;

Sources.Comparator = Comparator;
Sources.Index = Index;
module.exports = Sources;
