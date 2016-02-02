'use strict';

const Path = require('path');

const Source = require('./index');
const Parser = require('../parser');
const Storage = require('../storage');

const Reflect = require('../util/reflect');

/**
 * Consul Source
 *
 * Watch a Consul service
 *
 * @class Source.Consul
 * @extends Source
 *
 * @param {Parser} parser
 * @param {Object} options
 *
 */
class Consul extends Source {
  constructor(parser, params, update) {
    super(parser, params, update);

    // The Consul source does not support reconfigurations. Changes will almost
    // certainly be distructive, thus if an update is _really_ required, the source
    // should me renamed to trigger a replacement.
    this.method = params.method;
    this.options = params.options;
    this.state = null;
  }

  initialize(ready) {
    super.initialize(ready);
    const _this = this;

    this._watcher = this.constructor.service.watch({
      method: this.method,
      options: this.options
    });

    // Feed updates from the watcher directly into a parser
    this._watcher.on('change', function (data) {
      // Watches aren't very atomic. The watcher implementation _in Consul_ actually
      // does this comparison... https://github.com/hashicorp/consul/blob/master/watch/plan.go#L85
      if (Reflect.equal(_this.state, data)) return;

      _this.state = data;
      _this._update(data);
    });

    // Log and bubble up errors from the watcher. The watcher _should_ handle
    // errors by entering a backoff cycle and re-trying its request at $FUTURE
    this._watcher.on('error', function (err) {
      _this._error(err);
    });

    return this;
  }

  shutdown() {
    super.shutdown();

    this._watcher.end();
    delete this._watcher;

    return this;
  }
}

Consul.type = 'consul';
Source.register(Consul);

/**
 * Initialize an Consul client
 */
Consul.service = new (require('consul'))(Config.get('consul'));

/**
 * Cousul Health endpoint parser
 *
 * Expects the output from https://www.consul.io/docs/agent/watches.html#service
 *
 * @class Consul.Health
 * @extends Parser
 */
class Health extends Parser.Properties {
  constructor(source, options) {
    super(source, options);
    this.namespace = options.namespace;
  }

  update(data) {
    const _this = this;
    const properties = {};

    properties['conqueso.' + this.namespace + '.ips'] = [];
    properties['service.' + this.namespace + '.address'] = [];
    properties['service.' + this.namespace + '.node'] = [];

    data.forEach(function (node) {
      properties['service.' + _this.namespace + '.address'].push(node.Node.Address);
      properties['service.' + _this.namespace + '.node'].push(node.Node.Node);

      // Conqueso compatability
      properties['conqueso.' + _this.namespace + '.ips'].push(node.Node.Address);
    });

    this.properties = properties;
  }
}

/**
 * Cousul Catalog endpoint parser
 *
 * Expects the output from https://www.consul.io/docs/agent/watches.html#services.
 * This parser provides an intermediary facility to initialize watchers for all services
 * in the Consul catalog. It will be deprecated and replaced by inline source definitions
 * in the Properties Schema.
 *
 * @class Consul.Catalog
 * @extends Parser
 */
class Catalog extends Parser.Sources {
  update(data) {
    const sources = [];

    const config = {
      type: 'consul',
      parser: Consul.Health,
      parameters: {
        method: Consul.service.health.service,
        options: {
          passing: true
        }
      }
    };

    // Parse Consul API responses into compatible source definitions
    Object.keys(data).sort().forEach(function (service) {
      if (data[service].length === 0) {
        // Set up a watcher for a service with no tags
        return sources.push(Reflect.merge.deep(config, {
          name: service,
          parameters: {
            options: {service},
            namespace: service
          }
        }));
      }

      // Watch each tagged cluster of the service
      data[service].forEach(function (cluster) {
        sources.push(Reflect.merge.deep(config, {
          name: service + '-' + cluster,
          parameters: {
            options: {
              service,
              tag: cluster
            },
            namespace: cluster
          }
        }));
      });
    });

    this.updateSources(sources);
  }
}

/* Export */
module.exports = Consul;
Consul.Catalog = Catalog;
Consul.Health = Health;