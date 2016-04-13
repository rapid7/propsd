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
  }
}
~~~

### Configuration Key Reference ###

* `service` - This object allows setting options to control the HTTP API.
  * `hostname` - The address the HTTP API binds to. Defaults to "127.0.0.1".
  * `port` - The port the HTTP API listens on. Defaults to 9100.
