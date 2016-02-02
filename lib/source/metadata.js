'use strict';

var Crypto = require('crypto');
var Path = require('path');

var Source = require('./index');
var Parser = require('../parser');

/**
 * Metadata Source
 *
 * Expose EC2 metadata to the proeprty-set
 *
 * @class Source.Metadata
 * @extends Source
 *
 * @param {Parser} parser
 * @param {Object} options
 *      - {Number} interval Polling interval. Default 30s.
 */
class Metadata extends Source.Polling {
  constructor(options, update) {
    options = options || {};
    if (!options.hasOwnProperty('name')) options.name = 'ec2-metadata';
    if (!options.hasOwnProperty('namespace')) options.namespace = 'instance';

    super(Metadata.Parser, options, update);

    this.signature = null;
  }

  _fetch(callback) {
    var _this = this;

    this.constructor.traverse(function(err, data) {
      if (err) return callback(err);

      // Detect change by hashing the fetched data
      var hash = Crypto.createHash('sha1');
      Object.keys(data).sort().forEach(function(key) {
        hash.update(key + ':' + data[key]);
      });

      var signature = hash.digest('base64');
      if (_this.signature == signature) return callback(null, false);

      _this.signature = signature;
      callback(null, data);
    });
  }

  /**
   * Metadata.traverse
   *
   * Fetch all values from the EC2 matadata tree
   *
   * @param  {Function} callback(err, paths) Return an error or a hash of paths and their values
   * @return {Void}
   */
  static traverse(callback) {
    var timer = Date.now();

    var _this = this;
    var values = {};
    var paths = ['/meta-data/', '/dynamic/'];

    each(paths, function(path, next) {
      _this.service.request(Path.join('/', _this.version, path), function(err, data) {
        if (err) return next(err);

        // This is a list! Split new-line delimited strings into an array and add to tail of paths
        if (path.slice(-1) == '/') {
          var items = data.trim().split('\n');

          // Is this a list?
          if (items.reduce(function(memo, item) {
              return memo && METADATA_LIST.test(item);
            }, true)) {
            var list = values[path.slice(1, -1)] = [];

            items.forEach(function(item) {
              var match = item.match(METADATA_LIST);
              if (match) list[match[1]] = match[2];
            });

            return next();
          }

          items.forEach(function(node) {
            paths.push(Path.join(path, node));
          });

          return next();
        }

        // Remove leading `/`
        values[path.slice(1)] = data;
        next();
      });
    }, function(err) {
      callback(err, values);
    });
  }
}

Metadata.version = 'latest';
Metadata.type = 'ec2-metadata';
Source.register(Metadata);

/**
 * Initialize the metadata-service client
 */
Metadata.service = new(require('aws-sdk').MetadataService)({
  httpOptions: {
    timeout: 500
  },
  host: Config.get('metadata:host')
});

var METADATA_LIST = /^(\d+)=(.+)$/;

/**
 * Iterate over a list of tasks in parallel, passing one to each call of the
 * `work` function. When all tasks are complete, or an error is encountered, call the
 * `done` function, with an error if one occured.
 *
 * This implementation iterates over a work-list non-destructivly, without cloning it.
 * meaning that more tasks can be added safely while the work-loop is running.
 *
 * @param  {Array}    list    Set of tasks to work on
 * @param  {Function} work    The operation to perfrom on each element of `list`
 * @param  {Function} done    Callback on error or completion
 * @param  {Object}   options { parallel: Number limit parallel tasks. Default 16 }
 * @return {Void}
 */
function each(list, work, done, state) {
  state = state || {
    parallel: 16,
    error: false
  };

  // Default values
  if (isNaN(state.running * 1)) state.running = 0;
  if (isNaN(state.cursor * 1)) state.cursor = 0;

  // No more items to process
  if (state.cursor >= list.length) {
    // Call done if this was the last branch
    if (state.running === 0 && !state.error) done();

    return;
  }

  // Already enough tasks in flight
  if (state.running >= state.parallel) return;

  // Get an item off of the list, move up the cursor, and get a semaphore.
  var item = list[state.cursor];
  state.cursor += 1;
  state.running += 1;

  // Branch parallel requests
  while (state.running < state.parallel &&
         state.cursor < list.length) each(list, work, done, state);

  // Process this branch's task
  work(item, function(err) {
    state.running -= 1; // Release the semaphore

    // An error has occured. Just bail.
    if (state.error) return;

    if (err) {
      state.error = true;
      return done(err);
    }

    // Iterate
    each(list, work, done, state);
  });
}

/**
 * Metadata Parser
 *
 * @class Source.Metadata.Parser
 * @extends Parser
 *
 */
class MetadataParser extends Parser.Properties {
  constructor(source, options) {
    super(source, options);
    this.namespace = options.namespace;
  }

  update(data) {
    var _this = this;
    var properties = {};

    Object.keys(data).forEach(function(key) {
      // Try parsing content as JSON
      try {
        properties[_this.namespace + '.' + key.replace(/\//g, '.')] = JSON.parse(data[key]);
        return;
      } catch(e) {}

      properties[_this.namespace + '.' + key.replace(/\//g, '.')] = data[key];
    });

    this.properties = properties;
  }
}

/* Export */
module.exports = Metadata;
Metadata.Parser = MetadataParser;
