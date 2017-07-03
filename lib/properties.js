'use strict';
const EventEmitter = require('events').EventEmitter;
const Layer = require('./properties/layer');
const View = require('./properties/view');
const TokendTransformer = require('./transformers/tokend');
const Immutable = require('immutable');
const isPlainObject = require('lodash.isplainobject');

/* eslint-disable eqeqeq */
/**
 * Deep-merge one Object into another. Do _not_ deep merge anything that isn't explicitly
 * a first-order instance of Object.
 *
 * @param  {Object} destination   The destination of the merge operation. This object is mutated
 * @param  {Object} source        The source that properties are merged from
 * @return {Object}               The destination object
 */
const merge = (destination, source) => {
  // Ensure that the destination value is an Object.
  const dest = isPlainObject(destination) ? destination : {};

  // Only merge source if it's an Object.
  if (!isPlainObject(source)) {
    return dest;
  }

  Object.keys(source).forEach((key) => {
    // Ignore null and undefined source values. `== null` covers both
    if (source[key] == null) {
      return;
    }

    // Is this an Object (but not something that inherits Object)?
    if (Object.getPrototypeOf(source[key]) === Object.prototype) {
      // Recursively merge source Object into destination
      dest[key] = merge(dest[key], source[key]);

      return;
    }

    dest[key] = source[key];
  });

  return dest;
};
/* eslint-enable eqeqeq */

/**
 * Recursively traverses a layer namespace and sets the value at the corresponding place in the object
 * @param {Object} destination The destination of the merge operation.
 * @param {Array<String>} namespaceArray An array of keys (namespaces) to traverse
 * @param {Object} source The source that properties are merged from
 * @return {Object}
 */
const recusiveNamespaceMerge = (destination, namespaceArray, source) => {
  const nextNamespace = namespaceArray.shift();
  const dest = isPlainObject(destination) ? destination : {};

  if (namespaceArray.length) {
    dest[nextNamespace] = recusiveNamespaceMerge(dest[nextNamespace] || {}, namespaceArray, source);

    return dest;
  }

  dest[nextNamespace] = merge(dest[nextNamespace], source);

  return dest;
};

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

      const properties = merge(
        this.active.sources.reduce((properties, source) => merge(properties, source.properties), {}),
        persistent
      );

      this.tokendTransformer.transform(properties).then((transformedProperties) => {
        this.persistent = persistent;
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
Properties.merge = merge;

module.exports = Properties;
