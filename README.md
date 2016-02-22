# Propsd

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
so you can run propsd without terminal output.

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
