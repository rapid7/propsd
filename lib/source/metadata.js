/* global Log, Config */
'use strict';

const Crypto = require('crypto');
const Path = require('path');
const Aws = require('aws-sdk');

const METADATA_LIST = /^(\d+)=(.+)$/;
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
class Metadata extends Source(Parser) { // eslint-disable-line new-cap
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

    this.signature = null;
  }

  shutdown() {
    super.shutdown();
    this.signature = null;

    return this;
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
   * Fetch all values from the EC2 metadata tree
   *
   * @param  {Function} callback(err, paths) Return an error or a hash of paths and their values
   * @private
   */
  _traverse(callback) {
    const values = {};
    const paths = ['/meta-data/', '/dynamic/'];

    Util.each(paths, (path, next) => {
      this.service.request(Path.join('/', this._version, path), (err, data) => {
        if (err) {
          return next(err);
        }

        // This is a tree! Split new-line delimited strings into an array and add to tail of paths
        if (path.slice(-1) === '/') {
          const items = data.trim().split('\n');

          // Is this a list?
          if (items.reduce((memo, item) => memo && METADATA_LIST.test(item), true)) {
            const list = values[path.slice(1, -1)] = [];

            items.forEach((item) => {
              const match = item.match(METADATA_LIST);

              if (match) {
                list[match[1]] = match[2];
              }
            });

            return next();
          }

          items.forEach((node) => paths.push(Path.join(path, node)));
          return next();
        }

        // Remove leading `/`
        values[path.slice(1)] = data;
        next();
      });
    }, (err) => callback(err, values), null);
  }

  /**
   *
   * Fetch implementation for EC2 Metadata
   * @param {Function} callback
   * @private
   */
  _fetch(callback) {
    this._traverse((err, data) => {
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

      if (this.signature === signature) {
        return callback(null, Source.NO_UPDATE);
      }

      this.signature = signature;
      callback(null, data);
    });
  }
}

Metadata.version = 'latest';

/* Export */
module.exports = Metadata;
