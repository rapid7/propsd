Class: Source.Consul
======================

Watch a Consul endpoint for changes. Uses a Consul (Watcher)[https://github.com/silas/node-consul#watch] to monitor an endpoint.

### Constructor `(parser, params, update)`

* extends   `Source`
* parameter `params` {`Object`}
  * `method`  {`Function`}  The Consul API method to watch
  * `options` {`Object`}    Parameters to pass to the API method


### Instance Attribute `state`

A reference to the last resource document received from the Consul Watcher's `change` event

### Instance Attribute `_watcher`

An instance of (`Consul.Watcher`)[https://github.com/silas/node-consul#watch]. On the watcher's `change` event, the new resource is compared to `state`. If changes have occurred, `state` is set to the new resource, and `_update` is called. This behavior is consistent with that implemented in the [`consul watch` CLI](https://github.com/hashicorp/consul/blob/master/watch/plan.go#L85).


## Class Consul.Health

`Consul.Health` is an implementation of `Parser.Properties`. It's update method consumes a JSON document from the watcher's `change` event for a [service-type watcher](https://www.consul.io/docs/agent/watches.html#service)

```json
{
  "Attribute `namespace`" : {
    "Attribute `service`": {
      "node": ["Array of node-names"],
      "address": ["Array of IPv4 addresses"]
    }
  }
}
```

### Instance Attribute `namespace`

A String value at which properties for Consul services should be attached in the output Object

### Instance Attribute `service`

A String value representing the name of the

## Class Consul.Catalog

`Consul.Catalog` is a `Parser.Sources` implementation to instantiate Consul sources to watch the health endpoints for every service in the catalog. This is a temporary module to incorporate Consul services into the property set. It should be deprecated when sources can be defined in-line in the Properties schema.

The managed Consul sources use the Health parser, with the namespace 'service', and a key for each service or cluster in the catalog. Currently, we assume that each tag on a service is a cluster, nodes have only one tag, and a service with no tags has no clustering. Services with no clustering are keyed by the service name. Services with clustering (e.g. tagged), are keyed by the cluster name.

The resulting properties from a managed source are similar to

```json
{
  "service": {
    "consul": {
      "address": [
        "10.0.0.1",
        "10.0.1.1"
      ],
      "node": [
        "consul-0",
        "consul-1"
      ]
    }
  }
}
```

This structure is merged with others from consul services by the Storage layer,
resulting in a document similar to

```json
{
  "service": {
    "consul": {
      "address": [
        "10.0.0.1",
        "10.0.1.1"
      ],
      "node": [
        "consul-0",
        "consul-1"
      ]
    },
    "service-0": {
      "address": [
        "10.0.0.2",
        "10.0.1.2"
      ],
      "node": [
        "i-f00ba400",
        "i-ba704200"
      ]
    },
    ...
  },
  "other": "properties",
  ...
}
```
