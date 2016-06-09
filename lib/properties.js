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
   * Concatenate layers' sources with the active view's sources
   *
   * @return {Array}
   */
  get sources() {
    return []

      // Get Dynamic layers' source instances
      .concat(this.layers.map((layer) => layer.source).filter((source) => !!source))

      // Add the active View's sources. Reversed for precedence consistency with Layers:
      // Entry 0 is most precedent, LAST is least precedent.
      .concat(this.active.sources.reverse());
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

      this.active.sources
        .forEach((source) => Properties.merge(properties, source.properties));

      // Merge layers into their own object. This can be consumed as an input by
      // template renderers.
      const persistent = {};

      this.layers

        // Merge layers in reverse. `layers[0]` is the most precedent
        .reverse()
        .forEach((layer) => {
          if (!layer.namespace) {
            return Properties.merge(persistent, layer.properties);
          }

          // Merge into a namespace key
          persistent[layer.namespace] =
            Properties.merge(persistent[layer.namespace], layer.properties);
        });

      // Merge layers' properties into the global property object
      Properties.merge(properties, persistent);

      this.persistent = persistent;
      this.properties = properties;
      this.emit('build', this.properties);

      delete this._building;
    }, Properties.BUILD_HOLD_DOWN);

    return built;
  }

  /* eslint-disable eqeqeq, no-param-reassign */
  /**
   * Deep-merge one Object into another. Do _not_ deep merge anything that isn't explicitly
   * a first-order instance of Object.
   *
   * @param  {Object} destination   The destination of the merge operation. This object is mutated
   * @param  {Object} source        The source that properties are merged from
   * @return {Object}               The destination object
   */
  static merge(destination, source) {
    // Ensure that the destination value is an Object. `== null ` covers both null and undefined
    const dest = (destination == null ||
      Object.getPrototypeOf(destination) !== Object.prototype) ? {} : destination;

    Object.keys(source).forEach(function iterate(key) {
      // Ignore null and undefined source values. `== null` covers both
      if (source[key] == null) { return; }

      // Is this an Object (but not something that inherits Object)?
      if (Object.getPrototypeOf(source[key]) === Object.prototype) {
        // Recursively merge source Object into destination
        this.merge(dest[key], source[key]);
        return;
      }

      dest[key] = source[key];
    });

    return dest;
  }

  /* eslint-enable eqeqeq, no-param-reassign */
}

// Build hold-down timeout
Properties.BUILD_HOLD_DOWN = 1000; // eslint-disable-line rapid7/static-magic-numbers

Properties.Layer = Layer;
Properties.View = View;

module.exports = Properties;
