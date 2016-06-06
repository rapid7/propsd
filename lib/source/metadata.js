/* global Log, Config */
'use strict';

const Crypto = require('crypto');
const Aws = require('aws-sdk');

const METADATA_TIMEOUT = 500;

const Source = require('./common');
const Parser = require('./metadata/parser');
const Util = require('./metadata/util');

/**
 * Metadata Source
 *
 * Expose EC2 metadata to the property-set
 *
 * @class Source.Metadata
 * @extends EventEmitter
 *
 * @param {Parser} parser
 * @param {Object} options
 *      - {Number} interval Polling interval. Default 30s.
 */
class Metadata extends Source.Polling(Parser) { // eslint-disable-line new-cap
  constructor(opts) {
    // Inject defaults into options
    const options = Object.assign({
      host: Config.get('metadata:host')
    }, opts);

    super('ec2-metadata', options);

    /**
     * Initialize the metadata-service client
     */
    this.service = new Aws.MetadataService({
      httpOptions: {
        timeout: METADATA_TIMEOUT
      },
      host: options.host
    });
  }

  /**
   * Metadata version
   *
   * Used to prepend paths for calls to the EC2 Metadata Service,
   * e.g. /<version>/meta-data/ami-id
   *
   * @returns {string}
   * @private
   */
  get _version() {
    return this.constructor.version;
  }

  /**
   *
   * Fetch implementation for EC2 Metadata
   * @param {Function} callback
   * @private
   */
  _fetch(callback) {
    Util.traverse(
      ['/meta-data/', '/dynamic/'],

      // Call `Metadata.request` for each path
      (path, cb) => this.service.request(path, cb),

      // Handle results of metadata tree traversal
      (err, data) => {
        if (err) {
          return callback(err);
        }

        // Detect change by hashing the fetched data
        const hash = Crypto.createHash('sha1');

        Object.keys(data)
          .sort()
          .forEach((key) => {
            hash.update(`${key}:${data[key]}`);
          });

        const signature = hash.digest('base64');

        if (this._state === signature) {
          return callback(null, Source.NO_UPDATE);
        }

        this._state = signature;
        callback(null, data);
      }
    );
  }
}

Metadata.version = 'latest';

/* Export */
module.exports = Metadata;
