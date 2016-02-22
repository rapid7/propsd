Class: Storage
==============

The `Storage` module is responsible for managing data sources and merging their properties into a single document in the correct order. In "Version 1", it will use a dedicated S3Watcher to fetch an index object from S3, and add/remove sources accoding to an array defined therein.

_In a future version, the Storage module should be able to discover new sources from fetched objects, removing the need for an out-of-band definition of sources in an index. Instead, the Storage module would initialize its first source(s) from local configuration, and find additional sources recursively from their own contents._

## Interface

### Class Attribute: `properties`

```
Storage.properties
```

The hash of merged properties from all sources. The value should be re-composed from sources' own properties whenever a source emits an `update` event.

### Class Attribute: `sources`

```
Storage.sources
```

An array of active Source instances

### Instance Method: `update()`

Sources should call the `update` method to notify the Storage class when they have new properties.

### Instance Method: `register(source)`

Sources should register with the Storage class by calling the `register` method. The `register` method takes the source as an argument. Only registered sources' properties will be merged when `update` is called.

## Class: Storage.Index

A Scheme for defining an ordered set of sources to be managed by the Storage module. This scheme will parse a JSON array of Source definitions:

```json
{
  "sources": [{
    "name": "s3-data-source",
    "type": "s3",
    "bucket": "bucket name (optional, default: from local configuration)",
    "path": "path/to/source/object.json",
    "interval": "Number in ms (opional, default in local config)"
  }, {
    "name": "s3-account",
    "type": "s3",
    "path": "/account/{{ instance.account-id }}.json",
    "interval": 30000
  }, {
    "name": "s3-region",
    "type": "s3",
    "bucket": "non-default-bucket",
    "path": "/region/{{ instance.region }}.json"
  }, {
    "name": "s3-vpc",
    "type": "s3",
    "path": "/region/{{ instance.region }}/{{ instance.vpc-id }}.json"
  },
  ...
  {
    "name": "s3-instance",
    "type": "s3",
    "path": "/region/{{ instance.region }}/{{ instance.vpc-id }}/this_is_an_example/{{ instance.instance-id }}.json"
  }]
}
```

It should expose an array of Source objects, which becomes the value of `Storage.sources`.

### TODO: Complete when the Source interfce has been defined
