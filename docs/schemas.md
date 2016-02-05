# Schemas

## Manifest file (index.yaml / index.json)
Props.d will be configured to consume a manifest file (index.yaml) from an S3 object, which will drive the configuration of properties sources. The `source` key must be an array of objects with keys `name`, `type`, and `parameters`:

```yaml
---
version: 1.0
sources:
  - name: global
    type: s3
    parameters:
      path: global.json

  - name: account
    type: s3
    parameters:
      path: account/{{ instance.account }}.json
      bucket: 'a-different-s3-bucket'
# ...
```

## Github stored YAML configuration files
The content of the template configuration file stored in Github should have the following structure:

##### 1.0 schema

```yaml
---
version: 1.0
properties:
  foo: bar
```  

## S3 stored JSON configuration files
The content of the initial configuration file stored in S3 should have the following structure:

##### 1.0 Schema

```json
{
  "version": 1.0,
  "properties": {
    "key": "value",
    "key": "value"
  }
}
```

1.0 will get back the entire consul catalog of instances.

##### Proposed 1.1 Schema

```json
{
  "version": 1.1,
  "constant": 4,
  "sources": {
    "rabbitmq": {
      "type": "consul",
      "tags": ["tag", "tag", "tag", "..."]
    },
    "cassandra": {
      "type": "consul",
      "tags": ["tag", "tag", "tag", "..."]
    }
  },
  "properties": {
    "disks": "{{constant}}",
    "rabbit.nodes": "{{sources.rabbitmq.ipaddress}}"
  }
}
```

With the multitude of layering options, the sources are read from global down to instance name (last in, first out).  Then the sources should be compiled down and de-duplicated before property expansion occurs.  Then property expansion occurs and the resulting property set is returned.

##### Proposed recursive/remote loading

```json
{
  "version": 1.1,
  "constant": 4,
  "sources": [
    {
      "name": "rabbitmq",
      "type": "consul",
      "tags": ["tag", "tag", "tag", "..."]
    },
    {
      "name": "config",
      "type": "S3",
      "path": "",
      "bucket": "(optional)"
     }
  ],
  "properties": {
    "disks": "{{constant}}",
    "rabbit.nodes": "{{sources.rabbitmq.ipaddress}}"
  }
}
```
Where we could load an arbitrary S3 path to provide additional configuration to be compiled down for later token expansion.
