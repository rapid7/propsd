'use strict';
const EventEmitter = require('events').EventEmitter;

class Layer extends EventEmitter {
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
 */
class Static extends Layer {
  constructor(properties, namespace) {
    super(namespace);
    this.properties = properties;
  }
}

/**
 * A Dynamic layer wraps a Source with an optional namespace and forwards its
 * update events to a parent Properties object.
 */
class Dynamic extends Layer {
  constructor(source, namespace) {
    super(namespace);
    this.source = source;

    source.on('update', () => this.emit('update', this));
  }

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
