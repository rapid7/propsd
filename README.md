# Propsd

## Usage

The Propsd server runs under [Node.js][]. Run the following command to start it.

~~~bash
node bin/server.js
~~~

This will start the [HTTP server][http-api] listening on port 127.0.0.1:9100. If
you need to specify different server options, see the configuration section
below. Inline help is available with the `--help` argument.

~~~bash
node bin/server.js --help
~~~

## Configuration

Propsd reads its configuration from a JSON file. The `--config-file` argument
can be provided to specify where to read the configuration file from. The
following configuration options are supported.

### service:hostname

This defines the address the propsd server will listen on. By default it's
127.0.0.1.

### service:port

This defines the port the propsd server will listen on. By default it's 9100.

### log:level

This defines the verbosity of logging. The default level is "info". Other
supported values are "debug", "warn", and "error".

### log:filename

Propsd logs to $STDOUT by default. This defines an additional file for logging
so you can run propsd without terminal output. Log files aren't rotated by
propsd, so you'll want to configure something externally to handle that if
you enable file logging.

### properties

The `properties` object can contain any arbitrary properties you want loaded into the `Metadata#properties` object when it's being used to interpolate sources from the index. 

For example, a config file with the following `properties` object:

~~~json
{
	...
	"properties": {
		"foo": "bar",
		"baz": "s3"
	}
	...
}	
~~~

When presented with the following index document:

~~~json
{
	"version": 1.0,
	"sources": [
		{
			"name": "foo",
			"type": "{{ baz }}",
			"parameters": {
				"path": "{{ foo }}.json"
			}
		}
	]
}
~~~

Will yield this source:

~~~json
{
	"name": "foo",
	"type": "s3",
	"parameters": {
		"path": "bar.json"
	}
}
~~~


### Example

An example configuration file is shown below. The server's address is set to
10.0.0.0 and the port is set to 2600. The log level is set to warning and
file logging is enabled.

~~~json
{
  "service": {
    "hostname": "10.0.0.0",
    "port": 2600
  },
  "log": {
    "level": "warn",
    "filename": "/var/log/propsd.log"
  }
}
~~~

### Development

To run Propsd locally without dependencies on the AWS Instance Metadata Service or AWS S3, you can run local test versions of both. Currently these services are only tested on OS X.

#### Metadata Service

To run the test metadata server:
~~~bash
npm run metadata-server
~~~

The server will listen on `http://127.0.0.1:8080`. It can be used in the same way that you would use the AWS Instance Metadata Service (e.g. `curl http://127.0.0.1:8080/latest/meta-data/ami-id`). To specify the metadata service host and port that Propsd will use modify the config file:
~~~json
{
  ...
  "metadata": {
    "host": "127.0.0.1:8080"
  }
  ...
}
~~~

#### S3 Server
To run the test S3 server:
~~~bash
npm run s3-server -- -d <data directory>
~~~
The `-d` or `--data` argument is required. If you need to specify different server options you can view the S3 server help by running `npm run s3-server -- --help`.

Sample data ships with the Propsd project for the test suite to use but the same data can be served from the test server as well. Run the following command to start with test data:
~~~bash
npm run s3-server -- -d test/data/s3
~~~
This will start the test server and serve S3 objects from the `test/data/s3` directory. Because of some peculiarities in the library being used for the server, you cannot live-edit the test data. Instead, you must shut down the server, edit the data, then restart it.

The bucket the objects are served from is `propsd-<final directory in path>` and the endpoint is the server IP address. So, for example, if you use the provided test data, the relevant section of the config file would be:
~~~json
{
  ...
  "index": {
    "endpoint": "http://127.0.0.1:4569",
     "path": "index.json",
     "interval": 30000
  }
  ...
}
~~~

If an `endpoint` key is provided, the S3 source and it's underlying client will assume that you are serving data from another location and will ignore the `region` key, if provided.


[Node.js]: https://nodejs.org/en/
[http-api]: docs/http-api.md
