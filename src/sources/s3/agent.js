import * as AWS from 'aws-sdk';

class Agent {
  /**
   * @param bucket {string}
   * @param path {string}
   */
  constructor(bucket, path) {
    this._bucket = bucket;
    this._path = path;
    this._s3 = new AWS.S3();
  }

  /**
   * Generates query params for S3
   * @param eTag
   * @returns {{Bucket: (string|*), Key: (string|*), IfNoneMatch: (string|*)}}
   */
  _createS3Params(eTag = null) {
    let s3params = {
      Bucket: this._bucket,
      Key: this._path
    };

    if (eTag) {
      s3params.IfNoneMatch = eTag;
    }
    return s3params;
  }

  /**
   * Fetches an object from S3
   * @param eTag
   * @returns {Promise}
   */
  fetch(eTag) {
    const params = this._createS3Params(eTag);
    return new Promise((resolve, reject) => {
      this._s3.getObject(params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }
}

export default Agent;
