var Path = require('path');

var Source = require('./index');
var Parser = require('../parser');
var Storage = require('../storage');

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
var Consul = module.exports = function(parser, params, update) {
  Source.call(this, parser, params, update);

  // The Consul source does not support reconfigurations. Changes will almost
  // certainly be distructive, thus if an update is _really_ required, the source
  // should me renamed to trigger a replacement.
  this.method = params.method;
  this.options = params.options;
};

Consul.type = 'consul';

Source.extends(Consul);
Source.register(Consul);

/**
 * Initialize an Consul client
 */
Consul.service = new (require('consul'))(Config.get('consul'));

Consul.override('initialize', function(parent, ready) {
  parent(ready);
  var _this = this;

  this._watcher = this.constructor.service.watch({
    method: this.method,
    options: this.options
  });

  // Feed updates from the watcher directly into a parser
  this._watcher.on('change', function(data, res) {
    console.log('CONSUL UPDATE ' + _this.name + '@' + this._options.index)
    _this._update(data);
  });

  // Log and bubble up errors from the watcher. The watcher _should_ handle
  // errors by entering a backoff cycle and re-trying its request at $FUTURE
  this._watcher.on('error', function(err) {
    _this._error(err);
  });

  return this;
});

Consul.override('shutdown', function(parent) {
  parent();

  this._watcher.end();
  delete this._watcher;

  return this;
});

/**
 * Cousul Health endpoint parser
 *
 * Expects the output from https://www.consul.io/docs/agent/watches.html#service
 *
 * @class Consul.Health
 * @extends Parser
 */
Consul.Health = function(options) {
  Parser.call(this);
  this.namespace = options.namespace;
};

Parser.extends(Consul.Health);

Consul.Health.prototype.update = function(data) {
  var _this = this;
  var properties = {};

  properties['conqueso.' + this.namespace + '.ips'] = [];
  properties['service.' + this.namespace + '.address'] = [];
  properties['service.' + this.namespace + '.node'] = [];

  data.forEach(function(node) {
    properties['service.' + _this.namespace + '.address'].push(node.Node.Address);
    properties['service.' + _this.namespace + '.node'].push(node.Node.Node);

    // Conqueso compatability
    properties['conqueso.' + _this.namespace + '.ips'].push(node.Node.Address);
  });

  this.properties = properties;
};

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
Consul.Catalog = function(options) {
  Parser.Sources.call(this);
};

Parser.Sources.extends(Consul.Catalog);

Consul.Catalog.prototype.update = function(data) {
  console.log('CONSUL SOURCES')
  console.log(data);

  var sources = [];

  var config = {
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
  Object.keys(data).sort().forEach(function(service) {
    if (data[service].length === 0) {
      // Set up a watcher for a service with no tags
      return sources.push(merge(config, {
        name: service,
        parameters: {
          options: {
            service: service,
          },
          namespace: service
        }
      }));
    }

    // Watch each tagged cluster of the service
    data[service].forEach(function(cluster) {
      sources.push(merge(config, {
        name: service + '-' + cluster,
        parameters: {
          options: {
            service: service,
            tag: cluster
          },
          namespace: cluster
        },
      }));
    });
  });

  this.updateSources(sources);
};

/**
 * Merge helper
 */
function merge(source, destination) {
  Object.keys(source).forEach(function(key) {
    if (!!source[key] && // Not null
        !(source[key] instanceof Function) && // Not a function
        source[key] instanceof Object)
      return merge(source[key], destination[key] || {})

    destination[key] = source[key];
  });

  return destination;
}
