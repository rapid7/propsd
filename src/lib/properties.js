import {EventEmitter} from 'events';
import Layer from './properties/layer';
import View from './properties/view';
import TokendTransformer from './transformers/tokend';
import Immutable from 'immutable';
import {merge, recusiveNamespaceMerge} from './util';

/**
 * A Properties instance manages multiple statically configured layers,
 * and an active View instance.
 */
class Properties extends EventEmitter {
  // Build hold-down timeout
  static BUILD_HOLD_DOWN = 1000;

  /**
   * Constructor
   */
  constructor() {
    super();

    this.initialized = false;

    this.layers = [];
    this._properties = Immutable.Map();
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
   * Return a transformed set of properties
   * @return {Promise<Object>}
   */
  get properties() {
    return this.tokendTransformer
      .transform(this._properties).then((transformedProperties) => { // eslint-disable-line arrow-body-style
        return Immutable.Map(this._properties).mergeDeep(transformedProperties).toJS();
      });
  }

  /**
   * Register a dynamic Source layer
   *
   * @param {Source}  source
   * @param {String}  namespace
   */
  addDynamicLayer(source, namespace) {
    this.layers.push(new Layer.Dynamic(source, namespace));
  }

  /**
   * Register a static layer
   *
   * @param {Object}  properties
   * @param {String}  namespace
   */
  addStaticLayer(properties, namespace) {
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
      const persistent = this.layers.reduce((properties, layer) => {
        if (!layer.namespace) {
          return merge(properties, layer.properties);
        }

        let namespace = layer.namespace.split(':');
        const namespaceRoot = namespace.shift();

        if (namespace.length > 0) {
          properties[namespaceRoot] = recusiveNamespaceMerge(properties[namespaceRoot], namespace, layer.properties);
        } else {
          properties[namespaceRoot] = merge(properties[namespaceRoot], layer.properties);
        }

        return properties;
      }, {});

      this.persistent = persistent;
      this._properties = merge(
        this.active.sources.reduce((properties, source) => merge(properties, source.properties), {}),
        persistent
      );

      this.emit('build', this.properties);
      delete this._building;
    }, Properties.BUILD_HOLD_DOWN);

    return built;
  }
}

module.exports = Properties;
