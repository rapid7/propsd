'use strict';

const DeepEqual = require('deep-equal');

/**
 * Class to compare two indices and build the next Index.
 *
 * @class Comparator
 */
class Comparator {
  /**
   * Compare the configurations of two indices
   *
   * @param  {Index} current
   * @param  {Index} next
   * @return {Comparator}
   */
  static compare(current, next) {
    const difference = new this(current, next);

    // Find new sources
    difference.create = next.order.filter((name) =>
      !current.configurations.hasOwnProperty(name));

    // Find removed sources
    difference.destroy = current.order.filter((name) =>
      !next.configurations.hasOwnProperty(name));

    // Find updated or unchanged sources
    next.order.forEach((name) => {
      if (!current.configurations.hasOwnProperty(name)) {
        // New source. Ignore.
        return;
      }

      const a = current.configurations[name];
      const b = next.configurations[name];

      // Same same.
      if (this.equals(a, b)) {
        difference.copy.push(name);

        return;
      }

      difference.destroy.push(name);
      difference.create.push(name);
    });

    return difference;
  }

  /**
   * Class getter for the default comparison algorithm
   *
   * @return {Function}
   */
  static get equals() {
    return DeepEqual;
  }

  /**
   * Constructor
   * @param {Index} current
   * @param {Index} next
   */
  constructor(current, next) {
    this.current = current;
    this.next = next;

    this.create = [];
    this.copy = [];
    this.destroy = [];
  }

  /**
   * Return whether there are changes between the current Index and the next Index
   * @return {boolean}
   */
  get changes() {
    return this.create.length !== 0 || this.destroy.length !== 0;
  }

  /**
   * Create or copy source instances for the NEXT index
   *
   * @param  {Object} providers A hash of type-to-class for Sources
   * @return {Index} The NEXT index
   */
  build(providers) {
    this.create.forEach((name) => {
      const config = this.next.configurations[name];

      if (!providers.hasOwnProperty(config.type)) { // eslint-disable-line no-use-before-define
        Log.log('WARN', `Source type ${config.type} does not have a registered provider! Ignoring.`);

        return;
      }

      const Type = providers[config.type];

      this.next.sources[name] = new Type(config.name, config.parameters);
    });

    this.copy.forEach((name) => {
      this.next.sources[name] = this.current.sources[name];
    });

    return this.next;
  }

  /**
   * Shutdown removed sources in the CURRENT index
   *
   * @return {Index} The CURRENT index
   */
  cleanup() {
    this.destroy.forEach((name) => {
      this.current.sources[name].shutdown();
    });

    return this.current;
  }
}
module.exports = Comparator;
