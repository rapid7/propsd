var EventEmitter = require('events').EventEmitter;
var S3Watcher = require('./source/s3-watcher');
var IndexParser = require('./parser/index-parser');

var Storage = module.exports = new EventEmitter();

Object.defineProperty(Storage, 'sources', {
  enumerable: true,
  get: function() {
    return this.index.parser.sources;
  },
  writable: false
});

Storage.index = new S3Watcher({
  name: 'index',
  bucket: Config.get('index:bucket'),
  path: Config.get('index:path'),
  parser: new IndexParser(),
  interval: Config.get('index:interval')
});

Storage.update = function() {
  var properties = {};

  this.sources.forEach(function(source) {
    merge(source.properties, properties);
  });

  this.properties = properties;
};

/**
 * Copy key/value pairs from source to destination
 *
 * @param  {Object} source      Object that kay/value pairs will be read from
 * @param  {Object} destination Object that key/value pairss will be written to
 * @return {Object}             The `destination` object
 */
function merge(source, destination) {
  destination = destination || {};
  if (!(source instanceof Object)) return destination;

  Object.keys(source).forEach(function(key) {
    destination[key] = source[key];
  });

  return destination;
}

// Calling `merge` with no destination is a shallow clone
var clone = merge;
