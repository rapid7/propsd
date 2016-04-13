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

### Example Configuration File ###
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


[apache]: https://httpd.apache.org/docs/2.4/logs.html#combined
