# How to configure propsd #

Configuration options for propsd can be specified by providing a configuration
file on the command-line.

## Command-line Options ##

The options below are specified on the command-line.

* `--config` - A configuration file to load. For more information on the format
  of this file, see the **Configuration Files** section. Only one configuration
  file can be specified. Multiple uses of this argument will result in only the
  last configuration file being read.

## Configuration Files ##

Configuration files are JSON formatted. They are a single JSON object
containing configuration values.

### Minimal Configuration File ###

The configuration file below is the minimal settings that must be specified in
order for propsd to run.

~~~json
{
  "index": {
    "bucket": "propsd.corp.com"
  }
}
~~~

### Default Configuration File ###

The configuration file below is the default settings for propsd.

~~~json
{
  "service": {
    "hostname": "127.0.0.1",
    "port": 9100
  },
  "log": {
    "level": "info",
    "access": {
      "level": "verbose"
    }
  },
  "index": {
    "path": "index.json",
    "interval": 30000,
    "region": "us-east-1"
  }
}
~~~

### Configuration Key Reference ###

* `service` - These settings control the HTTP API.

  The following keys are available:

  * `hostname` - The address the HTTP API binds to. Defaults to "127.0.0.1".

  * `port` - The port the HTTP API listens on. Defaults to 9100.

* `log` - These settings control logging.

  Propsd treats logging as an event stream and logs to `stdout`. If you
  need routing or storage of logs, you'll want to handle that outside propsd.

  The following keys are available:

  * `level` - The level to log at. Valid values are "debug", "verbose", "info",
    "warn", and "error". Each log level encompases all the ones below it. So
    "debug" is the most verbose and "error" is the least verbose. Defaults to
    "info".

  * `access` - These settings control access logging.

  Propsd logs access requests to its end points. Access requests are logged in
  JSON format using the [Apache combined log format][apache].

  The following keys are available:

    * `level` - The level to log access requests at. Valid values are "debug",
      "verbose", "info", "warn", and "error". Setting this to a level that's
      equal to or lower than the `log:level` makes access logs visible. Defaults
      to "verbose".

* `index` - These settings control the first file properites are read from.

  Propsd reads properties from files stored in Amazon S3. Property files are
  JSON documents. A single property file must be configured as an index that
  lists other property files to read. Property files are polled periodicaly for
  changes. This allows new property files to be read at run time without
  requiring a restart of propsd.

  * `bucket` - The S3 bucket to read the index property file from. This has no
    default value and must be explicitly configured.

  * `region` - The AWS region where the S3 bucket is located. Defaults to
    "us-east-1".

  * `path` - The path in the S3 bucket to read as the index property file.
    Defaults to "index.json".

  * `interval` - The time in milliseconds to poll the index property file for
    changes. Defaults to 30000 (30 seconds).


[apache]: https://httpd.apache.org/docs/2.4/logs.html#combined
