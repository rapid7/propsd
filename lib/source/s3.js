var Path = require('path');

var Source = require('./index');
var Parser = require('../parser');

var debug = require('util').debuglog('propsd.source.metadata');

/**
 * S3 Source
 *
 * Poll an S3 object
 *
 * @class Source.S3
 * @extends Source
 *
 * @param {Parser} parser
 * @param {Object} options
 *      - {Number} interval Polling interval. Default 30s.
 */
var S3 = module.exports = function(parser, options, update) {
  Source.Polling.call(this, parser, options, update);

  this.etag = null;
};

S3.type = 's3';

Source.Polling.extends(S3);
Source.register(S3);

/**
 * Initialize an S3 client
 */
S3.service = new(require('aws-sdk').S3)({
  region: Config.get('index:region')
});

S3.override('configure', function(parent, params) {
  var changed = parent(params);

  changed = S3.setIfChanged(this, 'bucket', params.bucket || Config.get('index:bucket')) || changed;
  changed = S3.setIfChanged(this, 'path', params.path) || changed;

  return changed;
});

S3.prototype._fetch = function(callback) {
  var _this = this;

  this.constructor.service.getObject({
    Bucket: this.bucket,
    Key: this.path,
    IfNoneMatch: this.etag
  }, function(err, data) {
    if (err) {
      if (err.code == 'NotModified') return callback(null, false);

      Log.error(err, {
        source: _this.name,
        type: _this.type
      });
      return callback(err);
    }

    _this.etag = data.ETag;
    callback(null, data.Body);
  });
};
