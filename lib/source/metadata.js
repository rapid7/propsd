/* global Log, Config */
'use strict';

const Crypto = require('crypto');
const Aws = require('aws-sdk');

const Source = require('./common');
const Parser = require('./metadata/parser');
const Util = require('./metadata/util');
const MetadataClient = require('../util/metadata-client');

/**
 * Metadata Source
 *
 * Expose EC2 metadata to the property-set
 *
 * @class Source.Metadata
 * @extends Source.Polling
 *
 * @param {Parser} parser
 */
class Metadata extends Source.Polling(Parser) { // eslint-disable-line new-cap
  /**
   * Constructor
   * @param {Object} opts
   *      - {Number} interval Polling interval. Default 30s.
   */
  constructor(opts) {
    // Inject defaults into options
    const options = Object.assign({
      timeout: Metadata.DEFAULT_TIMEOUT,
      host: Metadata.DEFAULT_HOST
    }, opts);

    super('ec2-metadata', options);

    /**
     * Initialize the metadata-service client
     */
    this.service = new MetadataClient({
      timeout: options.timeout,
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
   */
  get version() {
    return this.constructor.version;
  }

  /**
   * Fetch implementation for EC2 Metadata
   * @param {Function} callback
   * @private
   */
  _fetch(callback) {
    Util.traverse(this.version, Parser.paths,

      // Call `Metadata.request` for each path
      (path, cb) => this.service.request(path, cb),

      // Handle results of metadata tree traversal
      (err, data) => {
        if (err) {
          return callback(err);
        }

        let p = Promise.resolve(data);

        // Grab the ASG from the instance-id
        const instanceId = data['meta-data/instance-id'];
        const az = data['meta-data/placement/availability-zone'];

        if (instanceId && az) {
          const region = az.slice(0, -1);

          p = new Promise((resolve, reject) => {
            (new Aws.AutoScaling({region})).describeAutoScalingInstances({InstanceIds: [instanceId]}, (err, d) => {
              if (err) {
                Log.log('ERROR', err);

                return reject(err);
              }
              resolve(d);
            });
          }).then((d) => {
            const asg = d.AutoScalingInstances.map((instance) => instance.AutoScalingGroupName);

            // No reason it should be longer than 1 but worth a check
            if (asg.length > 1) {
              Log.log('WARN', `Instance id ${instanceId} is in multiple auto-scaling groups`, asg);
            }

            // Check to see if an instance is actually part of an ASG
            if (asg.length !== 0) {
              data['auto-scaling-group'] = asg[0];
            }

            return data;
          }).catch(() => data);
        }

        p.then((data) => {
          // Detect change by hashing the fetched data
          const hash = Crypto.createHash('sha1');
          const paths = Object.keys(data);

          Log.log('DEBUG', `Source/Metadata: Fetched ${paths.length} paths from the ec2-metadata service`, this.status());

          paths.sort().forEach((key) => {
            hash.update(`${key}:${data[key]}`);
          });

          const signature = hash.digest('base64');

          if (this._state === signature) {
            return callback(null, Source.NO_UPDATE);
          }

          this._state = signature;
          callback(null, data);
        });
      }
    );
  }
}

Metadata.version = 'latest';
Metadata.DEFAULT_TIMEOUT = 500; // eslint-disable-line rapid7/static-magic-numbers
Metadata.DEFAULT_HOST = '169.254.169.254:80';

/* Export */
module.exports = Metadata;
