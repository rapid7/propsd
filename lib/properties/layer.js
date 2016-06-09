'use strict';
const EventEmitter = require('events').EventEmitter;

class Layer extends EventEmitter {
  constructor(namespace, options) {
    super();

    this.namespace = namespace;
    this.render = (options || {}).render !== false;
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
  constructor(properties, namespace, options) {
    super(namespace, options);
    this.properties = properties;
  }
}

/**
 * A Dynamic layer wraps a Source with an optional namespace and forwards its
 * update events to a parent Properties object.
 */
class Dynamic extends Layer {
  constructor(source, namespace, options) {
    super(namespace, options);
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
