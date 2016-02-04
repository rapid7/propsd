Class: Storage
==============

The `Storage` module is responsible for managing data sources and merging their properties into a single document in the correct order. In "Version 1", it will use a dedicated S3Watcher to fetch an index object from S3, and add/remove sources according to an array defined therein.

_In a future version, the Storage module should be able to discover new sources from fetched objects, removing the need for an out-of-band definition of sources in an index. Instead, the Storage module would initialize its first source(s) from local configuration, and find additional sources recursively from their own contents._

## Interface

### Class Attribute `properties`

```
Storage.properties
```

The hash of merged properties from all sources. The value should be re-composed from sources' own properties whenever a source emits an `update` event.

### Class Attribute `sources`

```
Storage.sources
```

An array of active Source instances

### Class Method `source(name)`

Fetch a Source instance by name

### Class Method `initialize()`

Create and initialize Metadata, Tags, Index, and Consul sources.

### Class Method `update()`

Recompile the properties objects from each Source instance in `Storage.sources` into a single object. Replaces the current value of `Storage.properties` with the new object. This method is triggered by `update` events from Source instances.

### Class Method `updateSources()`

Construct the `Storage.sources` array from configuration. In this implementation, the method uses sources defined in the S3 index, a source for each service in the local Consul datacenter, an EC2 metadata source, and EC2 instance tags source, in that order.
