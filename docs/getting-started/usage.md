# How to use propsd #

The propsd service is the core process in propsd. It's responsible for
providing the HTTP API and fetching properties from sources like Amazon S3 and
Consul. Propsd is machine aware, and is designed to run on every server that
needs to retrieve properties.

## Running propsd ##

The propsd service is started by running the `bin/server.js` binary. The binary
can be found in the folder where [propsd is installed][installation]. The
service blocks, running forever or until it's told to quit. The binary supports
several [configuration options][configuration].

When running propsd you should see output similar to this:

~~~text
~~~

## Stopping propsd ##

Propsd can be stopped by sending it an interrupt signal. This is usually done
by sending `Ctrl-C` from a terminal or by running `kill -INT $propsd_pid`.

## Monitoring propsd ##

Propsd provides two HTTP endpoints for monitoring its status. The first is
a health endpoint that provides basic information about propsd. Issue a GET
request to `/v1/health` and you'll see output similar to this:

~~~json
{
  "status": 200,
  "uptime": 3193957,
  "plugins": {
    "s3": 1
  }
}
~~~

The "status" attribute is the response code. Response codes from the health
endpoint are compatible with [Consul's HTTP health checks][consul]. The
"uptime" attribute is the number of milliseconds the service has been running.
The "plugins" attribute is a map from plugin type to the number of instances of
the plugin that are running.

The second endpoint is a status endpoint that provides detailed information
about propsd. Issue a GET request to '`/v1/status` and you'll see output
similar to this:

~~~json
{
  "status": 200,
  "uptime": 18160502,
  "index": {
    "running": true,
    "interval": 30000,
    "updated": "2016-04-25T13:00:04.257Z",
    "ok": true
  },
  "sources": [
    {
      "status": "okay",
      "type": "s3",
      "name": "s3-config.propsd-global.json"
    }
  ]
}
~~~

The "status" and "uptime" attributes match the ones from the health endpoint.
The "index" attribute provides metadata about the index property file, such as
the last time it was updated. The "sources" array provides metadata about each
of the sources propsd is reading properites from.

## Property Files ##


[installation]: "./installation.md"
[configuration]: "./configuration.md"
[consul]: https://www.consul.io/docs/agent/checks.html
