/* global Log, Config */
'use strict';

const Aws = require('aws-sdk');

/**
 * Wrapper class around the AWS MetadataService for error handling
 */
class MetadataClient {
  /**
   * Constructor
   * @param {Object} opts
   */
  constructor(opts) {
    const options = Object.assign({
      timeout: MetadataClient.DEFAULT_TIMEOUT,
      host: MetadataClient.DEFAULT_HOST
    }, opts);

    /**
     * Initialize the metadata-service client
     */
    this._service = new Aws.MetadataService({
      httpOptions: {
        timeout: options.timeout
      },
      host: options.host
    });
  }

  /**
   * Wrap the AWS MetadataService request function with error handling
   * @param {String} path
   * @param {Function} callback
   */
  request(path, callback) {
    this._service.request(path, (err, data) => {
      if (err) {
        /*
         * AWS-SDK > 2.6.0 now raises an error with a null message when the underlying http
         * request returns a non-2xx status code. We don't want to abort the rest of the traversal
         * for this. Instead, log the error and swallow it.
         */
        Log.log('ERROR', 'Aws-sdk returned the following error during the metadata service request ' +
            `to ${path}: %j`, err);

        return callback(null, undefined);
      }
      callback(err, data);
    });
  }
}

MetadataClient.version = 'latest';
MetadataClient.DEFAULT_TIMEOUT = 500; // eslint-disable-line rapid7/static-magic-numbers
MetadataClient.DEFAULT_HOST = '169.254.169.254:80';

/* Export */
module.exports = MetadataClient;
