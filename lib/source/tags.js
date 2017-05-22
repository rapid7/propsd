/* global Log, Config */
'use strict';

const Crypto = require('crypto');
const Aws = require('aws-sdk');

const Source = require('./common');
const Metadata = require('./metadata');
const MetadataClient = require('../util/metadata-client');
const Parser = require('./tags/parser');

/**
 * EC2 Tags Source
 *
 * Expose EC2 instance tags to the property-set
 *
 * @class Source.Tags
 * @extends Source.Polling
 *
 * @param {Parser} parser
 */
class Tags extends Source.Polling(Parser) { // eslint-disable-line new-cap
  /**
   * Constructor
   * @param {Object} opts
   */
  constructor(opts) {
    // Inject defaults into options
    const options = Object.assign({
      timeout: Metadata.DEFAULT_TIMEOUT,
      host: Metadata.DEFAULT_HOST
    }, opts);

    super('tags', options);

    this._metadata = new MetadataClient(options);
  }

  /**
   * Fetch implementation for EC2 tags API
   * @param {Function} callback
   * @private
   */
  _fetch(callback) {
    const path = `/${Metadata.version}/dynamic/instance-identity/document`;

    new Promise((resolve) => {
      this._metadata.request(path, (err, data) => {
        if (data) {
          return resolve(data);
        }

        return callback(null, {});
      });
    }).then((data) => {
      const document = JSON.parse(data);

      return {
        instance: document.instanceId,
        region: document.region
      };
    }).then((data) => {
      const client = new Aws.EC2({region: data.region});
      const params = {
        Filters: [{Name: 'resource-id', Values: [data.instance]}]
      };

      return new Promise((resolve) => {
        client.describeTags(params, (err, data) => {
          if (data) {
            return resolve(data);
          }

          return callback(null, {});
        });
      });
    }).then((data) => {
      const hash = Crypto.createHash('sha1');
      const tags = data.Tags;

      Log.log('DEBUG', `Source/Tags: Fetched ${tags.length} tags from the ec2 tags api`, this.status());

      tags.sort().forEach((tag) => {
        hash.update(JSON.stringify(tag));
      });

      const signature = hash.digest('base64');

      if (this._state === signature) {
        return callback(null, Source.NO_UPDATE);
      }

      this._state = signature;
      callback(null, data);
    }).catch((err) => {
      callback(err, null);
    });
  }
}

module.exports = Tags;
