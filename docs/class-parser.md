Class: Parser
=============

Parser is the class that will translate a strings into properties between storage and services

## Interface

### Class Attribute: `properties`

```
Parser.properties
```

The unmodified properties that need to be translated from human readable to json for services to read.

### Class Attribute: `sources`

```
Parser.sources
```

The source of the properties. ie S3, Conqueso, ect

### Constructor(properties (buffer), plugin_type (string))

### Class Method: `toJson`

```
toJson(properties (buffer)){

}
```

This will take the the buffer and translate it into json which is how the services read properties
