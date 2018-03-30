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
   * @returns {void}
   * @private
   */
  _fetch(callback) {
    const {error, values} = Util.traverse(
      this.version,
      Parser.paths,
      (path, cb) => this.service.request(path, cb)
    );

    if (error) {
      return callback(error);
    }

    let p = Promise.resolve(values);

    // Grab the ASG from the instance-id
    const instanceId = values['meta-data/instance-id'];
    const az = values['meta-data/placement/availability-zone'];

    if (instanceId && az) {
      const region = az.slice(0, -1);

      if (!this.parser.properties['auto-scaling-group']) {
        Log.log('DEBUG', 'Retrieving auto-scaling-group data');
        p = this._getAsgName(region, instanceId).then((asg) => {
          if (asg) {
            values['auto-scaling-group'] = asg;
          }

          return values;
        }).catch(() => values);
      } else {
        Log.log('DEBUG', 'Using cached auto-scaling-group data.');
        values['auto-scaling-group'] = this.properties['auto-scaling-group'];
        p = Promise.resolve(values);
      }
    }

    p.then((data) => {
      Log.log('DEBUG', `Source/Metadata: Fetched ${Object.keys(data).length} paths` +
        `from the ec2-metadata service`, this.status());
      const signature = this._hashMetaData(data);

      if (this._state === signature) {
        return callback(null, Source.NO_UPDATE);
      }

      this._state = signature;
      callback(null, data);
    });
  }

  /**
   * Get the ASG name
   *
   * @param {String} region The region the instance is in
   * @param {String} instanceId The instance Id
   * @returns {Promise}
   */
  _getAsgName(region, instanceId) {
    return (new Aws.AutoScaling({region})).describeAutoScalingInstances({InstanceIds: [instanceId]})
      .promise()
      .then((d) => {
        const asg = d.AutoScalingInstances.map((instance) => instance.AutoScalingGroupName);

        // No reason it should be longer than 1 but worth a check
        if (asg.length > 1) {
          Log.log('WARN', `Instance id ${instanceId} is in multiple auto-scaling groups`, asg);
        }

        // Check to see if an instance is actually part of an ASG
        if (asg.length !== 0) {
          return asg[0];
        }

        Log.log('INFO', `Instance ${instanceId} is not part of an autoscaling group.`);

        return null;
      });
  }

  /**
   * Hash data from the ec2metadata endpoint
   *
   * @param {Object} data Data retrieved from the ec2metadata endpoint
   * @returns {String}
   */
  _hashMetaData(data) {
    const hash = Crypto.createHash('sha1');
    const paths = Object.keys(data);

    paths.sort().forEach((key) => {
      hash.update(`${key}:${data[key]}`);
    });

    return hash.digest('base64');
  }
}

Metadata.version = 'latest';
Metadata.DEFAULT_TIMEOUT = 500; // eslint-disable-line rapid7/static-magic-numbers
Metadata.DEFAULT_HOST = '169.254.169.254:80';

/* Export */
module.exports = Metadata;
