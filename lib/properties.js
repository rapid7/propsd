const EventEmitter = require('events').EventEmitter;

class Layer extends EventEmitter {
  constructor(parent, namespace) {
    super();

    this.parent = parent;
    this.namespace = namespace;
  }
}

/**
 * A static Layer wraps an Object of properties with an optional namespace
 */
class Static extends Layer {
  constructor(parent, properties, namespace) {
    super(parent, namespace);
    this.properties = properties;
  }
}

/**
 * A Dynamic layer wraps a Source with an optional namespace and forwards its
 * update events to a parent Properties object.
 */
class Dynamic extends Layer {
  constructor(parent, source, namespace) {
    super(parent, namespace);

    this.source = source;
    source.on('update', () => parent.build());
  }

  get properties() {
    return this.source.properties;
  }
}

/**
 * A View aggregates the initialized events of multiple sources and safely
 * forwards their update events to a parent Properties object.
 */
class View extends Layer {
  constructor(parent) {
    super(parent);
    this.sources = [];

    /**
     * Create a statically bound method to register/deregister update events
     */
    this.onUpdate = function onUpdate() {
      /**
       * This is safe because the onUpdate handler is only registered to
       * sources after they have all initialized, and is removed before the View
       * is replaced.
       */
      this.parent.build();
    }.bind(this);
  }

  register(source) {
    this.sources.push(source);
  }

  /**
   * Initialize registered sources. Waits for all sources' initialize promises
   * to resolve, then deregisters the current active View's listeners from its
   * sources, then registers it self its update events before the parent
   * property set.
   *
   * @return {Promise}
   */
  activate() {
    // Already active
    if (this.parent.view === this) {
      return Promise.resolve(this.sources);
    }

    // Wait for all sources to initialize
    return Promise.all(this.sources.map((source) => source.initialize()))
      .then(() => {
        // Deregister current active view's update listeners
        this.parent.view.destroy();

        // Register for sources' update events
        this.sources.forEach((source) => {
          source.addListener('update', this.onUpdate);
        });

        // Set self as active view and rebuild properties
        this.parent.view = this;
        this.parent.build();
      });
  }

  destroy() {
    // Deregister from sources' update events
    this.sources.forEach((source) => {
      source.removeListener('update', this.onUpdate);
    });
  }
}

/**
 * Properties manages multiple statically configured layers, and View
 */
class Properties extends EventEmitter {
  constructor() {
    super();

    this.layers = [];
    this.properties = {};
    this.view = new View(this);
  }

  /**
   * Register a dynamic Source layer
   *
   * @param {Source}  source
   * @param {String}  namespace
   */
  dynamic(source, namespace) {
    this.layers.push(new Dynamic(this, source, namespace));
  }

  /**
   * Register a static layer
   *
   * @param {Object}  properties
   * @param {String}  namespace
   */
  static(properties, namespace) {
    this.layers.push(new Static(this, properties, namespace));
  }

  /**
   * Instantiate a new View
   *
   * @return {View}
   */
  view() {
    return new View(this);
  }

  /**
   * Flatten layers and view's sources into one properties object
   */
  build() {
    if (this._building) {
      return;
    }

    // Block building for a hold-down period to let multiple updates propagate
    this._building = setTimeout(() => {
      const properties = {};

      // TODO use a better merge function
      this.view.sources
        .forEach((source) => Object.assign(properties, source.properties));

      // Merge layers in reverse. `layers[0]` is the most precedent
      this.layers
        .reverse()
        .forEach((layer) => {
          if (!layer.namespace) {
            return Object.assign(properties, layer.properties);
          }

          // Merge into a namespace key
          if (!(properties[layer.namespace] instanceof Object)) {
            properties[layer.namespace] = {};
          }

          Object.assign(properties[layer.namespace], layer.properties);
        });

      delete this._building;
    }, Properties.BUILD_HOLD_DOWN);
  }
}

// Build hold-down timeout
Properties.BUILD_HOLD_DOWN = 1000; // eslint-disable-line rapid7/static-magic-numbers

Properties.Layer = Layer;
Properties.Static = Static;
Properties.Dynamic = Dynamic;
Properties.View = View;

module.exports = Properties;
