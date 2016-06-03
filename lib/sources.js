'use strict';
const EventEmitter = require('events').EventEmitter;
const STATUS_CODES = require('./util/status-codes');

const Comparator = require('./sources/comparator');
const Index = require('./sources/iindex');

class Sources extends EventEmitter {
  constructor(properties) {
    super();

    this.properties = properties;
    this.indices = [];

    this.initialized = false;
    this.current = new Index([]);
  }

  /**
   * Add an index document source
   *
   * @param  {Source} source
   */
  index(source) {
    this.indices.push(source);
  }

  /**
   * Initialize the Properties instance, then all of the index sources, then
   * trigger the first update.
   *
   * @return {Promise<Sources>}
   */
  initialize() {
    if (this.initialized) {
      return Promise.resolve(this);
    }
    this.initialized = true;

    return this.properties.initialize()
      .then(() => Promise.all(
        this.indices.map((source) => source.initialize())
      ))
      .then(() => {
        this.update();
      })
      .then(() => {
        // Subscribe to indices' update events
        this.indices.forEach((source) =>
          source.on('update', () => this.update()));

        // Subscribe to layers' update events once they're initialized
        this.properties.layers.forEach((layer) =>
          layer.on('update', () => this.update()));
      })
      .then(() => this);
  }

  /**
   * Create a new Index, instantiate new sources, create and activate a new view,
   * then shutdown retired sources
   *
   * @return {Promise<Sources>}
   */
  update() {
    const updated = new Promise((resolve) => {
      this.once('update', () => resolve(this));
    });

    if (this._updating) {
      return updated;
    }

    Log.log('INFO', 'Updating sources');

    // Block for a hold-down period to let multiple updates propagate
    this._updating = setTimeout(() => {
      let configs = [];

      // Aggregate Source configurations from index sources
      this.indices.forEach((source) => {
        if (!(source.sources instanceof Array)) {
          Log.log('WARN', `Index source ${source.name} does not have any sources. Ignoring.`);
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
        return;
      }

      // Build and activate a new view from the new Index, then clean up old sources.
      this.properties.view(next.ordered()).activate()
        .then(() => {
          Log.log('INFO', 'Updated sources successfully');
          this.emit('update', this.properties.properties);

          difference.cleanup();
          delete this._updating;
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
    const object = {
      code: STATUS_CODES.OK,
      status: 'OK'
    };

    object.indices = this.indices.map((source) => {
      // TODO This logic is fairly ham-fisted right now. It'll work because nothing
      // is setting `state` to WARNING at the moment. When we do start supporting a
      // WARNING state, this will have to become aware that OK < WARING < ERROR.
      if (!source.ok) {
        object.code = STATUS_CODES.INTERNAL_SERVER_ERROR;
        object.status = source.state;
      }

      return source.status();
    });

    object.sources = this.properties.sources.map((source) => {
      if (!source.ok) {
        object.code = STATUS_CODES.INTERNAL_SERVER_ERROR;
        object.status = source.state;
      }

      return source.status();
    });

    return object;
  }
}

// Registered Source providers
Sources.providers = {
  s3: require('./source/s3')
};

// Update hold-down timeout
Sources.UPDATE_HOLD_DOWN = 1000; // eslint-disable-line rapid7/static-magic-numbers

Sources.Index = Index;
module.exports = Sources;
