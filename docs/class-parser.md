Class: Parser
=============

Parser modules are data-transformation layers for various sources. The `Parser` module in this version serves little functional purpose, other than an inheritance base. In future versions, validation and additional interface features may be added.

### Constructor `(source, options)`

* parameter `source`  {`Source`}  The parent source object
* parameter `options` {`Object`}  The parameters Object passed to the parent source instance's constructor

### Method: `update(data)`

The `update` method injects new data for parsing. The format of the input data is implementation-specific.

* parameter `data`  {`Mixed`} An implementation-specific input for the parser to normalize

## Class `Parser.Properties`

The `Properties` parser is a generic interface for file-type configuration sources (e.g. an S3 object or a file on disk). The current interface, `1.0`, expects a Buffer containing a JSON document with a `version` key equal to `1.0`, and a `properties` key with an Object value. The parser may perform some validation upon inputs.

```json
{
  "version": 1.0,
  "properties": {
    "key": "value"
  }
}
```

### Instance Attribute `properties`

An Object containing parsed properties from the last source update.

### Method: `update(data)`

* parameter `data`  {`Buffer`} A Buffer containing a string of UTF-8 characters in valid JSON format.

## Class: `Parser.Sources`

The `Sources` parser, like `Properties`, consumes a Buffer of JSON, but expects a `sources` key instead of `properties`. The `sources` key must have an Array value containing a set of source configurations as Objects. On update, the parser iterates over the set of source configurations, checking if each is already instantiated. It updates those that already exist, initializes new instances that do not, and shuts down removed instances.

When a new instance is initialized, the `Sources` parser emits a `source` event through its parent `Source`, allowing consumers to perform additional configurations on the new source.

```json
{
  "version": 1.0,
  "sources": [{
    "name": "s3-data-source",
    "type": "s3",
    "parameters": {
      "key": "source-specific configuration parameters",
      "bucket": "bucket name (optional, default: from local configuration)",
      "path": "path/to/source/object.json",
      "interval": "Number in ms for polling sources (optional, default in local config)"
    }
  },
  ...
  ]
}
```

### Instance Attribute `sources`

An Array of the currently configured Source instances, set by `update()`.

### Instance Attribute `_sources`

Return an Object containing `sources`, hashed by `name`
