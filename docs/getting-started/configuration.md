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
    "bucket": "propsd.s3.amazonaws.com"
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
    "level": "info"
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

  Propsd treats logging as an event stream and logs to `stdout`. Logged events
  are formatted as JSON objects separated by newlines. If you need routing or
  storage of logs, you'll want to handle that outside propsd.

  The following keys are available:

  * `level` - The level to log at. Valid values are "debug", "verbose", "info",
    "warn", and "error". Each log level encompasses all the ones below it. So
    "debug" is the most verbose and "error" is the least verbose. Defaults to
    "info".

* `index` - These settings control the first file properties are read from.

  Propsd reads properties from files stored in Amazon S3. Property files are
  JSON documents. A single property file must be configured as an index that
  lists other property files to read. Property files are polled periodically for
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

* `consul` - These settings control service discovery via [Consul][].

  Propsd can use Consul for service discovery. Services registered with Consul
  show up in propsd as properties that look like "conqueso.service.ips=127.0.0.1".
  IP addresses are comma separated and only services whose health checks are all
  passing will be reported. Consul is polled periodically for changes. This
  allows service discovery to happen without requiring a restart of propsd.

  * `host` - The host to connect to Consul on. Defaults to 127.0.0.1.

  * `port` - The HTTP port to connect to Consul on. Defaults to 8500.

  * `secure` - Whether to use HTTPS when connecting to Consul. Defaults to false
    and uses HTTP.

  * `interval` - The time in milliseconds to poll Consul for changes. Defaults
    to 60000 (60 seconds).

* `properties` - An arbitrary JSON object for injecting values into the index.

  Propsd supports treating the index document as a template and injecting
  static properties into it. This can be useful for loading additional
  properties files on a per server basis. For more information on the format of
  properties, see the **Interpolated Properties** section.

## Interpolated Properties ##

Propsd supports injecting static values defined in configuration files into the
property documents read from S3. This provides a way to read instance specific
properties.

Suppose you have two configurations for metrics polling, fast and slow. Fast
polls every thirty seconds and the configuration for it lives in
a `metrics/fast.json` document in S3. Slow polls every five minutes, and the
configuration for it lives in a `metrics/slow.json` document in S3.

Interpolated properties let you configure propsd to read either the fast or
slow document. You start by adding a `{{speed}}` template parameter to your
`index.json` document in S3.

~~~json
{
  "version": 1.0,
  "sources": [{
    "name": "metrics",
    "type": "s3",
    "parameters": {
      "path": "metrics/{{speed}}.json"
    }
  }]
}
~~~

When propsd reads the index template, it tries to replace `{{speed}}` with
a value from in the `properties` key in the configuration file. So the
configuration to read the "fast" document looks like this.

~~~json
{
  "properties": {
    "speed": "fast"
  }
}
~~~

If the `properties:speed` key was configured as "slow", the `metrics/slow.json`
document would be read instead.

Interpolated properties in templated documents are enclosed in double curly
braces: `{{` and `}}`. The value between the double curly braces is a key from
the `properties` object. Nested keys within the `properties` object are
accessed by separating the keys with colons.


[Consul]: https://www.consul.io/
