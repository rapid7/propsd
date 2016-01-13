## Sources.S3.Agent
Instantiated with a S3 bucket and path. On first run the `agent` will use the AWS SDK to query for a new version of the specified S3 object.

### Methods

* `constructor(bucket, path)`

* `_createS3Params(eTag = null)`
	* Generates the params object that the `aws-sdk` requires to retrieve an object.

* `fetch(eTag)`
	* Fetches an object from S3 and returns a `Promise`.


### Properties
* `_bucket`: (`string`) the S3 bucket
* `_path`: (`string`) the path to the S3 object
* `_s3`: (`AWS.S3`) an instance of an authenticated AWS S3 client