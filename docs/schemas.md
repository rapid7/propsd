# Schemas

## Manifest file (index.yaml / index.json)
Props.d will be configured to consume a manifest file (index.yaml) from the <s3 bucket name here> bucket.

The format of this yaml file will dictate the ordering of the configuration layering.  They are as follows:

##### index.yaml

```yaml
- global
- account
- region
- vpc
- product
  |- stack
- service
  |- version
- asg
- instance
```

The files will be stored in the <s3 bucket name here> bucket in the following structure:

```
- global
- account
- region
  |- vpc
  |- asg
  |- instance
- product
  |- stack
- service
  | - version
```

## Github stored yaml configuration files
The content of the template configuration file stored in Github should have the following structure:

##### 1.0 schema

```yaml
--- 
version: 1.0
properties:
  foo: bar
```  

##### Future proposed schema

```yaml
---
version: 1.1
sources:
  # This source will be coming from a consul lookup
  # which is looking for rabbitmq nodes with the listed
  # tags.
  - name: rabbitmq
    type: consul
    tags: [tag,tag,...]
properties:
  foo: bar
```  

## S3 stored json configuration files
The content of the initial configuration file stored in S3 should have the following structure:

##### 1.0 Schema

```json
{
  version: 1.0,
  properties:
  {
    key: value,
    key: value
  }
}
```
1.0 will get back the entire consul catalog of instances.

##### Proposed 1.1 Schema

```json
{
  version: 1.1,
  constant: 4
  sources: 
  {
    rabbitmq:
    {
      type: consul,
      tags: tag, tag, tag, ...
    },
    cassandra,
    {
      type: consul,
      tags: tag, tag, tag, ...
    },
  }
  properties:
  {
    disks: {{constant}},
    rabbit.nodes: {{sources.rabbitmq.ipaddress}}
  }
}
```

With the multitude of layering options, the sources are read from global down to instance name (last in, first out).  Then the sources should be compiled down and de-duplicated before property expansion occurs.  Then property expansion occurs and the resulting property set is returned.

##### Proposed recursive/remote loading

```json
{
  version: 1.1,
  constant: 4
  sources:
  [
    {
      name: rabbitmq,
      type: consul,
      tags: tag, tag, tag, ...
    },
    {
      name: config,
      type: S3,
      path: "",
      bucket: "(optional)"
     }
  ]
  properties:
  {
    disks: {{constant}},
    rabbit.nodes: {{sources.rabbitmq.ipaddress}}
  }
}
```
Where we could load an arbitrary S3 path to provide additional configuration to be compiled down for later token expansion.