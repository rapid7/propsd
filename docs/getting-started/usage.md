# How to use Propsd #

The Propsd service is the core process in Propsd. It's responsible for
providing the HTTP API and fetching properties from sources like Amazon S3 and
Consul. Propsd is machine aware, and is designed to run on every server that
needs to retrieve properties.

## Running Propsd ##

The Propsd service is started by running the `bin/server.js` binary. The binary
can be found in the folder where [Propsd is installed][installation]. The
service blocks, running forever or until it's told to quit. The binary supports
several [configuration options][configuration].

When running Propsd you should see output similar to this:

~~~text
{"level":"info","message":"Initializing index and metadata","timestamp":"2016-04-29T15:28:39.574Z"}
{"source":"s3-propsd-s3-index.json","type":"s3","level":"info","message":"Initializing s3 source s3-propsd-s3-index.json","timestamp":"2016-04-29T15:28:39.577Z"}
{"source":"ec2-metadata","type":"ec2-metadata","level":"info","message":"Initializing ec2-metadata source ec2-metadata","timestamp":"2016-04-29T15:28:39.590Z"}
{"level":"info","message":"Listening on 127.0.0.1:9100","timestamp":"2016-04-29T15:28:39.602Z"}
{"source":"s3-propsd-s3-index.json","type":"s3","level":"info","message":"Updated source s3-propsd-s3-index.json","timestamp":"2016-04-29T15:28:39.620Z"}
{"source":"ec2-metadata","type":"ec2-metadata","level":"info","message":"Updated source ec2-metadata","timestamp":"2016-04-29T15:28:39.658Z"}
{"source":"s3-propsd-s3-global.json","type":"s3","level":"info","message":"Initializing s3 source s3-propsd-s3-global.json","timestamp":"2016-04-29T15:28:39.659Z"}
~~~

## Stopping Propsd ##

Propsd can be stopped by sending it an interrupt signal. This is usually done
by sending `Ctrl-C` from a terminal or by running `kill -INT $propsd_pid`.

## Monitoring Propsd ##

Propsd provides two HTTP endpoints for monitoring its status. The first is
a health endpoint that provides basic information about Propsd. Issue a GET
request to `/v1/health` and you'll see output similar to this:

~~~json
{
  "status": 200,
  "uptime": 3193957,
  "plugins": {
    "s3": 1,
    "consul": 1,
  },
  "version": "1.2.5"
}
~~~

The "status" attribute is the response code. Response codes from the health
endpoint are compatible with [Consul's HTTP health checks][consul]. The
"uptime" attribute is the number of milliseconds the service has been running.
The "plugins" attribute is a map from plugin type to the number of instances of
the plugin that are running. The "version" attribute is the version of Propsd.

The second endpoint is a status endpoint that provides detailed information
about Propsd. Issue a GET request to `/v1/status` and you'll see output
similar to this:

~~~json
{
  "status": 200,
  "uptime": 18160502,
  "index": {
    "running": true,
    "name": "index",
    "type": "s3",
    "ok": true,
    "state": "RUNNING",
    "updated": "2016-06-10T14:53:08.453Z",
    "interval": 30000,
    "resource": "s3://bucket/index.json",
    "etag": "e81944e6e597d8e9e5db01b1cf9dfd7d"
  },
  "sources": [
    {
      "status": "okay",
      "interval": 60000,
      "updated": "2016-06-10T18:45:07.182Z",
      "state": "RUNNING",
      "ok": true,
      "type": "consul",
      "name": "consul"
    },
    {
      "status": "okay",
      "name": "global",
      "type": "s3",
      "ok": true,
      "state": "RUNNING",
      "updated": "2016-06-10T14:53:09.613Z",
      "interval": 60000,
      "resource": "s3://bucket/global.json",
      "etag": "4856c7b6c749068ea986f23668a41c46"
    }
  ],
  "vesion": "1.2.6"
}
~~~

The "status", "uptime", and "version" attributes match the ones from the health
endpoint. The "index" attribute provides metadata about the index property file,
such as the last time it was updated. The "sources" array provides metadata
about each of the sources Propsd is reading properties from.

## Index Files ##

The first file Propsd reads is called the index file. Index files are JSON
formatted. They are a single JSON object containing a version identifier and
a list of sources to read properties from. You must set [configuration
options][configuration] to tell Propsd where to find the index file.

### Minimal Index File ###

~~~json
{
  "version": "1.0",
  "sources": [{
    "name": "global",
    "type": "s3",
    "parameters": {
      "path": "global.json"
    }
  }]
}
~~~

The "version" attribute is required and must be "1.0". The "sources" attribute
is an array of source objects to read properties from. Propsd supports reading
properties from [Amazon S3][].

### Amazon S3 Source Key Reference ###

* `name` - An arbitrary string. Must be unique within all other sources of the
  same type. You'll see the name of the source in logs, so pick something
  meaningful.

* `type` - Must be "s3" to configure a S3 source.

* `parameters` - These settings control the S3 source.

  The following keys are available:

  * `path` - The path to the properties file in S3.

  * `bucket` - The bucket in S3 where the properties file is found. Defaults to
    the bucket where the index file was found.

### Amazon S3 Bucket Permissions ###

Propsd reads from S3, so you need to configure your bucket to allow read
access. The example bucket policy below shows how to grant read-only access to
a separate AWS account.

~~~json
{
  "Version": "2012-10-17",
  "Id": "propsd",
  "Statement": [{
    "Sid": "read-only-for-XXXXXXXXXXXX",
    "Effect": "Allow",
    "Principal": {
      "AWS": "arn:aws:iam::XXXXXXXXXXXX:root"
    },
    "Action": [
      "s3:ListBucket",
      "s3:GetObject",
      "s3:GetBucketLocation"
    ],
    "Resource": [
      "arn:aws:s3:::propsd.s3.amazonaws.com/*",
      "arn:aws:s3:::propsd.s3.amazonaws.com"
    ]
  }]
}
~~~

See [Amazon's documentation around bucket policies and user
policies][bucket-policies] for more details around controlling access to S3
buckets.

## Property Files ##

Property files are JSON formatted. They are a single JSON object containing
a version identifier and property values. Properties are read in the
order they're defined in the index file. Property files with matching values
overwrite those read before them.

### Minimal Properties File ###

~~~json
{
  "version": "1.0",
  "properties": {
    "nodejs.version": "4.4.3"
  }
}
~~~

### Property Files Key Reference ###

* `version` - A string that tells Propsd what version of the properties file
  it's reading. Must be "1.0".

* `properties` - A JSON object of properties.

  Keys with string, number and boolean values are converted directly to Java
  properties. Nested JSON objects are flattened, with their keys separated by
  periods. Arrays are converted into numbered properties e.g. the first item is
  "key.0", the second item is "key.1", the third item is "key.2", etc.

  The keys "instance", "consul", and "conqueso" are reserved for use by Propsd
  internally. Defining your own properties with those keys may result in
  unexpected behavior.


[installation]: "./installation.md"
[configuration]: "./configuration.md"
[consul]: https://www.consul.io/docs/agent/checks.html
[Amazon S3]: https://aws.amazon.com/s3/
[bucket-policies]: http://docs.aws.amazon.com/AmazonS3/latest/dev/using-iam-policies.html
