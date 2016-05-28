/* global Log, Config */
'use strict';

const Aws = require('aws-sdk');
const Source = require('./common');

class S3Parser {
  constructor() {
    this.properties = {};
  }

  update(data) {
    this.properties = JSON.parse(data.toString()).properties;
  }
}

class S3 extends Source(S3Parser) { // eslint-disable-line new-cap
  constructor(opts) {
    // Inject defaults into options
    const options = Object.assign({
      type: 's3'
    }, opts);

    if (!options.hasOwnProperty('bucket') || !options.hasOwnProperty('path')) {
      throw new Error('Bucket or path not supplied');
    }

    if (!options.hasOwnProperty('name')) {
      options.name = `s3-${options.bucket}-${options.path}`;
    }

    super(options);

    this.bucket = options.bucket || Config.get('index:bucket');
    this.path = options.path;
    this.etag = null;

    /**
     * Initialize the s3 client
     */
    const config = {};
    const endpoint = options.endpoint || Config.get('index:endpoint');

    if (endpoint) {
      config.endpoint = new Aws.Endpoint(endpoint);
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

  /**
   * Called by implementations to update source data
   *
   * @param {Buffer}  data  Updated data from an implementation-specific source
   * @return {S3} Reference to instance
   * @private
   */
  _update(data) {
    this._parser.update(data);

    // Logging to determine the extent of the update
    const diff = deepDiff(this.properties, this._parser.properties);

    if (diff) {
      Log.verbose(`Calculated ${this.name} properties diff during update`, {source: 'diff', diff});
    }

    this.properties = this._parser.properties;
    this._updated = new Date();
    this._ok = true;

    this.emit('update', this, {
      source: this.name,
      type: this.type
    });

    return this;
  }

  /**
   * Helper method to detect parameter changes
   *
   * @param {Object}  scope The target object on which to set a parameter
   * @param {String}  key   The property of `scope` to set
   * @param {*}   value The value to compare and set
   * @return {Boolean} True if the parameter has been updated
   * @static
   */
  static setIfChanged(scope, key, value) {
    if (scope[key] === value) {
      return false;
    }

    scope[key] = value; // eslint-disable-line no-param-reassign
    return true;
  }
}

module.exports = S3;
