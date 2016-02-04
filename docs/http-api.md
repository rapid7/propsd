HTTP API
========

The main interface to propsd is a HTTP API. The API can be used to retrieve properties and perform status checks. The endpoints are versioned to enable changes without breaking backwards compatibility.

Each endpoint manages a different aspect of propsd:

* health - Basic health check
* status - Detailed configuration information
* conqueso - Conqueso compatible API

## Health

The health endpoint is used to validate propsd is running. The endpoint responds to GET requests with a JSON body and a response code. Any other type of request returns a 405 (Method Not Allowed) response code and includes an `Allow: GET` header.

### /v1/health

An example response from the health API is:

```json
{
  "ok": true,
  "uptime": 0
}
```

The `ok` field is a boolean. It indicates that the index source is healthy and up to date.

Response codes are compatible with Consul HTTP health checks:
* A 200 (OK) is returned with an okay status.
* A 429 (Too Many Requests) is returned while the service is initializing.
* A 500 (Internal Server Error) is returned with a fail status.

The `uptime` felid is the number of milliseconds that the service process has been running.

## Status

The status endpoint is used to retrieve detailed configuration information about propsd. The endpoint responds to GET requests with a JSON body and a 200 (OK) response code. Any other type of request returns a 405 (Method Not Allowed) response code and includes an `Allow: GET` header.

### /v1/status

An example response from the status API is:

```json
{
  "ok": true,
  "uptime": "Number. Milliseconds since the service process started",
  "index": {
    "ok": true,
    "updated": "Date",
    "interval": 30000,
    "running": true
  },
  "sources": [{
    "name": "global-properties",
    "type": "s3",
    "status": {
      "ok": true,
      "updated": "Date",
      "interval": 3000,
      "running": true
    }
  }, {
    "name": "rabbitmq",
    "type": "consul",
    "status": {
      "ok": true,
      "updates": "2016-01-06T16:47:45Z"
    }
  }, {
    "name": "ec2-metadata",
    "type": "ec2-metadata",
    "status": {
      "ok": true,
      "updated": "2016-02-04T17:35:06.594Z",
      "interval": 30000,
      "running": true
    }
  }]
}
```

The `ok` field matches what's returned from the health API.

The `sources` field is an array of configured sources. A source object will always have the following keys: `name`, `type`, `status`. `status` is an Object, which will always have `ok` and `updated` keys. Different types of sources may add additional keys, e.g. Polling sources, like S3, include `running` and `interval` keys, indicating that the polling loop is active, and how often the resource is polled.

A source's type field is a string that maps to the underlying plugin/provider that the source was instantiated from.

A source's name field is a unique identity string.

## Conqueso

The Conqueso endpoint provides a partial implementation of the RESTful API
defined by [Conqueso][]. The endpoint responds to GET requests with text output
and a 200 (OK) response code. Output is formatted as Java compatible properties.

### /v1/conqueso

An example response from the Conqueso API is:

```text
aws.metrics.enabled=false
fitness.value=88.33
web.url.private=http://localhost:2600/
conqueso.frontend.ips=10.0.0.1,10.0.0.2
```

PUT and POST requests return an empty body and a 200 (OK) response code. They
don't create or update any properties internally.

Any other type of request returns a 405 (Method Not Allowed) response code and
includes an `Allow: GET, PUT, POST` header.

[Conqueso]: https://github.com/rapid7/conqueso "Conqueso (Rapid7): Centrally manage dynamic properties across services"
