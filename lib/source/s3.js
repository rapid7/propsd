/* global Log, Config */
'use strict';

const Aws = require('aws-sdk');
const Source = require('./common');

/**
 * Class to parse data returned from S3
 *
 * @class S3Parser
 */
class S3Parser {
  /**
   * Constructor
   */
  constructor() {
    this.properties = {};
  }

  /**
   * Parse the property set and update the parser's properties and sources
   * @param {Object} data
   */
  update(data) {
    const object = JSON.parse(data.toString());

    this.properties = object.properties || {};
    this.sources = object.sources || [];
  }
}

/**
 * S3 Source
 *
 * Retrieve data from S3 and return it to the property-set
 *
 * @class Source.S3
 * @extends Source.Polling
 *
 * @param {Parser} parser
 */
class S3 extends Source.Polling(S3Parser) { // eslint-disable-line new-cap
  /**
   * Constructor
   * @param {String} name
   * @param {Object} opts
   */
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

  /**
   * Get the S3 source status
   * @return {{name, type, ok, state, updated, resource, etag}|*}
   */
  status() {
    const object = super.status();

    object.resource = `s3://${this.bucket}/${this.path}`;
    object.etag = this._state;

    return object;
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
      IfNoneMatch: this._state
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

      this._state = data.ETag;
      callback(null, data.Body);
    });
  }
}

module.exports = S3;
