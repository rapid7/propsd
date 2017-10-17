'use strict';

const EventEmitter = require('events').EventEmitter;

/**
 * Base class for Static and Dynamic layers
 *
 * @class Layer
 * @extends EventEmitter
 */
class Layer extends EventEmitter {
  /**
   * Constructor
   * @param {String} namespace
   */
  constructor(namespace) {
    super();

    this.namespace = namespace;
  }

  /**
   * Initialize hook for layers that require it
   *
   * @return {Promise<Layer>}
   */
  initialize() {
    return Promise.resolve(this);
  }
}

/**
 * A static Layer wraps an Object of properties with an optional namespace
 *
 * @class Layer.Static
 * @extends Layer
 */
class Static extends Layer {
  /**
   * Constructor
   * @param {Object} properties
   * @param {String} namespace
   */
  constructor(properties, namespace) {
    super(namespace);
    this.properties = properties;
  }
}

/**
 * A Dynamic layer wraps a Source with an optional namespace and forwards its
 * update events to a parent Properties object.
 *
 * @class Layer.Dynamic
 * @extends Layer
 */
class Dynamic extends Layer {
  /**
   * Constructor
   * @param {Source} source
   * @param {String} namespace
   */
  constructor(source, namespace) {
    super(namespace);
    this.source = source;

    source.on('update', () => this.emit('update', this));
  }

  /**
   * The dynamic Source properties
   * @return {Object}
   */
  get properties() {
    return this.source.properties;
  }

  /**
   * Initialize the underlying source, resolving with the layer
   *
   * @return {Promise<Dynamic>}
   */
  initialize() {
    return this.source.initialize()
      .then(() => this);
  }
}

Layer.Static = Static;
Layer.Dynamic = Dynamic;
module.exports = Layer;
