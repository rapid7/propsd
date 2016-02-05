'use strict';

const Path = require('path');

const Source = require('./index');
const Parser = require('../parser');

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
class S3 extends Source.Polling {
  constructor(parser, options, update) {
    super(parser, options, update);

    this.etag = null;
  }

  configure(params) {
    let changed = super.configure(params);

    changed = S3.setIfChanged(this, 'bucket', params.bucket || Config.get('index:bucket')) || changed;
    changed = S3.setIfChanged(this, 'path', params.path) || changed;

    return changed;
  }

  _fetch(callback) {
    const _this = this;

    this.constructor.service.getObject({
      Bucket: this.bucket,
      Key: this.path,
      IfNoneMatch: this.etag
    }, function (err, data) {
      if (err) {
        if (err.code === 'NotModified') return callback(null, false);
        if (err.code === 'NoSuchKey') return callback(null, false);

        Log.error(err, {
          source: _this.name,
          type: _this.type
        });
        return callback(err);
      }

      _this.etag = data.ETag;
      callback(null, data.Body);
    });
  }
}

S3.type = 's3';
Source.register(S3);

/**
 * Initialize an S3 client
 */
S3.service = new (require('aws-sdk').S3)({
  region: Config.get('index:region')
});

/* Export */
module.exports = S3;
