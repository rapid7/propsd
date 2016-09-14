'use strict';

/**
 * A View aggregates the initialized events of multiple sources and safely
 * forwards their update events to a parent Properties object.
 */
class View {
  /**
   * Constructor
   * @param {Properties} parent
   * @param {Array} sources
   */
  constructor(parent, sources) {
    this.parent = parent;
    this.sources = sources instanceof Array ? sources : [];

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

  /**
   * Register a source to the View.
   *
   * The only use of this method in the codebase is during testing.
   *
   * @deprecated
   * @param {*} source
   */
  register(source) {
    this.sources.push(source);
  }

  /**
   * Initialize registered sources. Waits for all sources' `initialize` promises
   * to resolve, then deregisters the current active View's listeners from its
   * sources, then registers its own listeners for sources' update events, then
   * sets itself as the active view and builds the Properties instance.
   *
   * @return {Promise<View>}
   */
  activate() {
    const current = this.parent.active;

    // Already active
    if (this.parent.active === this) {
      return Promise.resolve(this);
    }
    this.parent.active = this;

    // Wait for all sources to initialize
    return Promise.all(this.sources.map((source) => source.initialize()))
      .then(() => {
        // Deregister current active view's update listeners
        current.destroy();

        // Register for sources' update events
        this.sources.forEach((source) => {
          source.addListener('update', this.onUpdate);
        });

        // Rebuild properties
        return this.parent.build().then(() => this);
      });
  }

  /**
   * Deregister handler from sources' update events
   */
  destroy() {
    this.sources.forEach((source) => {
      source.removeListener('update', this.onUpdate);
    });
  }
}
module.exports = View;
