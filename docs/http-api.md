# HTTP API #

The main interface to propsd is a HTTP API. The API can be used to retrieve
properties and perform status checks. The endpoints are versioned to enable
changes without breaking backwards compatibility.

Each endpoint manages a different aspect of propsd:

* health - Basic health check
* status - Detailed configuration information
* conqueso - Conqueso compatible API

## Health ##

The health endpoint is used to validate propsd is running. The endpoint responds
to GET requests with a JSON body and a response code. Any other type of
request returns a 405 (Method Not Allowed) response code and includes an
`Allow: GET` header.

### /v1/health ###

An example response from the health API is:

~~~json
{
  "status": "okay",
  "uptime": 1222101,
  "plugins": ["s3", "consul"]
}
~~~

The status field is a string with one of the following values: "okay",
"warn", "fail". The okay status means all of the plugins are working. The
warn status means some of the plugins are working. The fail status means none
of the plugins are working.

The uptime field is an integer representing the number of milliseconds propsd has been running.

The plugins field is an array of strings listing all the installed plugins.

Response codes are compatible with Consul HTTP health checks. A 200 (OK) is
returned with an okay status. A 429 (Too Many Requests) is returned with a
warning status. A 500 (Internal Server Error) is returned with a fail status.

## Status ##

The status endpoint is used to retrieve detailed configuration information about
propsd. The endpoint responds to GET requests with a JSON body and a 200 (OK)
response code. Any other type of request returns a 405 (Method Not Allowed)
response code and includes an `Allow: GET` header.

### /v1/status ###

An example response from the status API is:

~~~json
{
  "status": "okay",
  "uptime": 1222101,
  "index": "okay",
  "plugins": [{
    "type": "s3",
    "name": "global-properties",
    "bucket": "bucket",
    "path": "global.json",
    "status": "okay",
    "mtime": "2016-01-06T16:47:45-05:00"
  },{
    "type": "consul",
    "name": "consul:service:rabbitmq",
    "status": "okay",
    "mtime": "2016-01-06T16:47:45-05:00"
  }]
}
~~~

The status and uptime fields matches what's returned from the health API. The index field provides the status of the index source.

The plugins field is an array of plugin objects. A plugin object will always
have the following fields: "name", "type", "status", "mtime". Some plugin
objects may include additional fields.

A plugin's type field is a string that matches the plugin's type as it appears
in the "plugins" field from the health API.

A plugin's name field is a string describing the plugin. The name field is
unique for all instances of the same type of plugin.

A plugin's status field is a string with one of the following values: "okay",
"fail". The okay status means the plugin is working. The fail status means the
plugin is not working.

A plugin's mtime field is a time stamp of the last time the plugin checked
for updates. The time stamp is formatted as an ISO-8601 string with one second
resolution.

## Conqueso ##

The Conqueso endpoint provides a partial implementation of the RESTful API
defined by [Conqueso][]. The endpoint responds to GET requests with text output
and a 200 (OK) response code. Output is formatted as Java compatible properties.

### /v1/conqueso ###

An example response from the Conqueso API is:

~~~text
aws.metrics.enabled=false
fitness.value=88.33
web.url.private=http://localhost:2600/
conqueso.frontend.ips=10.0.0.1,10.0.0.2
~~~

PUT and POST requests return an empty body and a 200 (OK) response code. They
don't create or update any properties internally.

OPTIONS requests return an empty body and a 200 (OK) response code. They include
an `Allow: GET, POST, PUT, OPTIONS` header.

Any other type of request returns a 405 (Method Not Allowed) response code and
includes an `Allow: GET, POST, PUT, OPTIONS` header.

## Formatted JSON output ##

All JSON output is minimized by default. Formatted JSON is returned if a
`pretty` parameter is provided as part of a query string.


[Conqueso]: https://github.com/rapid7/conqueso "Conqueso (Rapid7): Centrally manage dynamic properties across services"
