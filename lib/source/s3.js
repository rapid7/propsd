/* global Log, Config */
'use strict';

const Aws = require('aws-sdk');
const Source = require('./common');

class S3Parser {
  constructor() {
    this.properties = {};
  }

  update(data) {
    const object = JSON.parse(data.toString());

    this.properties = object.properties || {};
    this.sources = object.sources || [];
  }
}

class S3 extends Source(S3Parser) { // eslint-disable-line new-cap
  constructor(name, opts) {
    // Inject defaults into options
    const options = Object.assign({
      bucket: Config.get('index:bucket'),
      endpoint: Config.get('index:endpoint')
    }, opts);

    if (!options.hasOwnProperty('bucket') || !options.bucket) {
      throw new ReferenceError('Source/S3: Missing required parameter `bucket`!');
    }

    if (!options.hasOwnProperty('path') || !options.path) {
      throw new ReferenceError('Source/S3: Missing required parameter `path`!');
    }

    super(name, options);

    this.bucket = options.bucket;
    this.path = options.path;
    this.etag = null;

    /**
     * Initialize the s3 client
     */
    const config = {};

    if (options.endpoint) {
      config.endpoint = new Aws.Endpoint(options.endpoint);
      config.s3ForcePathStyle = true;
    } else {
      config.region = Config.get('index:region');
    }

    this.service = new Aws.S3(config);
  }

  shutdown() {
    super.shutdown();
    this.etag = null;

    return this;
  }

  /**
   *
   * @param {Function} callback
   * @private
   */
  _fetch(callback) {
    this.service.getObject({
      Bucket: this.bucket,
      Key: this.path,
      IfNoneMatch: this.etag
    }, (err, data) => {
      if (err) {
        if (err.code === 'NotModified') {
          return callback(null, Source.NO_UPDATE);
        }

        if (err.code === 'NoSuchKey') {
          return callback(null, Source.NO_EXIST);
        }

        return callback(err);
      }

      this.etag = data.ETag;
      callback(null, data.Body);
    });
  }
}

module.exports = S3;
