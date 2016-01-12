## Sources.S3.Agent
Instantiated with a S3 path. On first run the `agent` will download the S3 object and store its ETag in the `store`. For each subsequent run, the `agent` will check to see if the stored ETag matches the current ETag for the object.

If the ETag does not match, the `agent` retrieves the object from S3 and emits an event with the S3 payload when the retrieval is complete. The `agent` then updates the ETag in the `store`.

### Methods

* `constructor(bucket, path)`
* `createS3Params()`
	* Generates the params object that the `aws-sdk` requires to retrieve an object.

