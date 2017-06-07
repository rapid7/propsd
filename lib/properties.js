'use strict';
const EventEmitter = require('events').EventEmitter;
const Layer = require('./properties/layer');
const View = require('./properties/view');
const TokendTransformer = require('./transformers/tokend');
const Immutable = require('immutable');

/**
 * A Properties instance manages multiple statically configured layers,
 * and an active View instance.
 */
class Properties extends EventEmitter {
  /**
   * Constructor
   */
  constructor() {
    super();

    this.initialized = false;

    this.layers = [];
    this.properties = Immutable.Map();
    this.active = new View(this);
    this.tokendTransformer = new TokendTransformer();
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

      // Add the active View's sources.
      //  NOTE: This is a shallow copy and only copies object references to a new array.
      //  DO NOT USE THIS GETTER TO PERFORM ANY MUTATING ACTIVITIES.
      .concat(this.active.sources.slice().reverse());
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
      this.layers.concat(this.tokendTransformer).map((source) => source.initialize())
    ).then((sources) => {
      // Once initialized, watch for sources' update events
      sources.forEach((source) => {
        source.on('update', () => this.build());
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
      // Merge layers into their own object. This can be consumed as an input by
      // template renderers.
      const persistent = this.layers.reduce((p, layer) => {
        if (!layer.namespace) {
          return p.mergeDeep(Immutable.fromJS(layer.properties));
        }
        const layerProps = Immutable.Map(layer.properties);

        return p.setIn(layer.namespace.split(':'), layerProps);
      }, new Immutable.Map());

      const properties = this.active.sources.reduce((p, source) => {
        const props = Immutable.fromJS(source.properties);

        return p.mergeDeep(props);
      }, new Immutable.Map())
          .mergeDeep(persistent)
          // Null properties should be filtered out entirely
          .filter((p) => !!p);

      this.tokendTransformer.transform(properties.toJS())
          .then((transformedProperties) => {
            this.persistent = persistent.toJS();
            this.properties = Immutable.Map(properties).mergeDeep(transformedProperties).toJS();

            this.emit('build', this.properties);
            delete this._building;
          });
    }, Properties.BUILD_HOLD_DOWN);

    return built;
  }
}

// Build hold-down timeout
Properties.BUILD_HOLD_DOWN = 1000; // eslint-disable-line rapid7/static-magic-numbers

Properties.Layer = Layer;
Properties.View = View;

module.exports = Properties;
