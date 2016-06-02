'use strict';
const EventEmitter = require('events').EventEmitter;
const Layer = require('./properties/layer');
const View = require('./properties/view');

/**
 * A Properties instance manages multiple statically configured layers,
 * and an active View instance.
 */
class Properties extends EventEmitter {
  constructor() {
    super();

    this.initialized = false;

    this.layers = [];
    this.properties = {};
    this.active = new View(this);
  }

  /**
   * Register a dynamic Source layer
   *
   * @param {Source}  source
   * @param {String}  namespace
   */
  dynamic(source, namespace) {
    this.layers.push(new Layer.Dynamic(source, namespace));
  }

  /**
   * Register a static layer
   *
   * @param {Object}  properties
   * @param {String}  namespace
   */
  static(properties, namespace) {
    this.layers.push(new Layer.Static(properties, namespace));
  }

  /**
   * Instantiate a new View
   *
   * @param {Array} sources An optional set of Sources to be passed to the new View
   * @return {View}
   */
  view(sources) {
    return new View(this, sources);
  }

  /**
   * Initialize persistent (Dynamic and Static) layers.
   *
   * @return {Promise<Properties>} resolves after a build has completed
   */
  initialize() {
    if (this.initialized) {
      return Promise.resolve(this);
    }
    this.initialized = true;

    return Promise.all(
      this.layers.map((layer) => layer.initialize())
    ).then((layers) => {
      // Once initialized, watch for layers' update events
      layers.forEach((layer) => {
        layer.on('update', () => this.build());
      });

      return this.build();
    });
  }

  /**
   * Flatten layers and view's sources into one properties object
   *
   * @return {Promise<Properties>}
   */
  build() {
    // return after starting building timeout
    const built = new Promise((resolve) => this.once('build', () => resolve(this)));

    if (this._building) {
      return built;
    }

    // Block building for a hold-down period to let multiple updates propagate
    this._building = setTimeout(() => {
      const properties = {};

      // TODO use a better merge function
      this.active.sources
        .forEach((source) => Object.assign(properties, source.properties));

      // Merge layers into their own object. This can be consumed as an input by
      // template renderers.
      const persistent = {};

      this.layers

        // Merge layers in reverse. `layers[0]` is the most precedent
        .reverse()
        .forEach((layer) => {
          if (!layer.namespace) {
            return Object.assign(persistent, layer.properties);
          }

          // Merge into a namespace key
          persistent[layer.namespace] =
            Object.assign(persistent[layer.namespace] || {}, layer.properties);
        });

      // Merge layers' properties into the global property object
      Object.assign(properties, persistent);

      this.persistent = persistent;
      this.properties = properties;
      this.emit('build', this.properties);

      delete this._building;
    }, Properties.BUILD_HOLD_DOWN);

    return built;
  }
}

// Build hold-down timeout
Properties.BUILD_HOLD_DOWN = 1000; // eslint-disable-line rapid7/static-magic-numbers

Properties.Layer = Layer;
Properties.View = View;

module.exports = Properties;
