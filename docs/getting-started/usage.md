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

Propsd reads JSON files from S3 and collapses them into properties. The first
file propsd reads is called the index file. The section on [configuration
options][configuration] describes how to tell propsd where to find the index
file. The index file contains a list of other S3 files where propsd should read
properties. Here's an example index file:

~~~json
{
  "version": "1.0",
  "sources": [{
    "name": "global",
    "type": "s3",
    "parameters": {
      "path": "global.json"
    }
  }, {
    "name": "service",
    "type": "s3",
    "parameters": {
      "path": "service/propsd.json"
    }
  }]
}
~~~

Properties are read into propsd in the order they're defined in the index file.
Property files with matching values overwrite ones read before them. In this
example, properties read from the `global.json` file can be overwritten in
the `service/propsd.json` file. This can be used to do things like set software
versions on a per application basis.

Here's an example `global.json` file with software versions defined for Jenkins
and Node.js.

~~~json
{
  "version": "1.0",
  "properties": {
    "jenkins.version": "1.651.1",
    "nodejs.version": "4.4.3"
  }
}
~~~

The "version" attribute is required and must be set to "1.0". The "properties"
attribute is a JSON object. Keys and intrinsic values (strings and numbers) in
the properties object are converted directly into Java properties. Nested JSON
objects are flattened, with their keys separated by periods. Arrays are
converted into numbered properties e.g. the first item is "key.0", the second
item is "key.1", the third item is "key.2", etc.

In the global file, both Jenkins and Node.js are set to use the LTS version. If
we want the propsd service to use the latest version of Node.js instead, we
can overwrite the "nodejs.version" attribute in the `service/propsd.json` file.

~~~json
{
  "version": "1.0",
  "properties": {
    "nodejs.version": "6.0.0"
  }
}
~~~

By setting the "nodejs.version" attribute, we create a composed set of
properties that looks like this:

~~~java
jenkins.version: "1.651.1",
nodejs.version: "6.0.0"
~~~


[installation]: "./installation.md"
[configuration]: "./configuration.md"
[consul]: https://www.consul.io/docs/agent/checks.html
