Class: Source
=============

Source modules are stateful interface abstractions for various external data sources. A Source must be able to maintain a 'current-state' of its remote/external data, and detect when that data changes. On change, the Source instance passes the new data entity to its parser, and emits an `update` event when the parser has finished updating its output.

### Constructor `(parser, options, update)`

* parameter `parser`  {`Class`}     A `Parser` class.
* parameter `options` {`Object`}    Configuration parameters for the source. Must have a unique `name` key.
* parameter `update()`  {`Function`}  An optional handler for the `update` event.

### Class Attribute `type`

A String that serves as a unique name each implementation of `Source`. Must be set before calling `Source.register`

### Class Attribute `handlers`

An Object mapping Source implementations' `type` to class

### Class Method `register(source)`

Add a type-to-class mapping to `Source.handlers`

* parameter `source`  `{Class}` A Source implementation Class with a unique `type` attribute

### Class Method `setIfChanged(scope, key, value)`

Set `key` of Object `scope` to `value`. Return `true` if a mutation occurs. This helper method is used in `configure()` implementations to detect updates to parameters.

### Instance Attribute `type`

Return the Class' `type` value

### Instance Attribute `properties`

Return the parser's `properties` value

### Instance Attribute `sources`

Return the parser's `sources` value

### Instance Attribute `_sources`

Return an Object containing `sources`, hashed by `name`

### Private Method: `_update(data)`

Called by Source implementations when new data is received

* parameter `data`  {`Mixed`} Source-specific data to be passed to the source's parser

### Private Method `_error(err)`

Called by implementations to signal that an error has occurred. If the Source has any listeners for the `error` event, then `_error()` will emit an `error` event.

* parameter `err` {`Error`} An Error object

### Method `configure(params)`

Sets configuration parameters for the Source instance. Implementations should override

### Method `initialize(ready)`

Fetch remote data and start monitoring for updates

* parameter `ready()` {`Function`}  Optionally, set a `once` handler on the `update` event. The first `update` event after the Source is initialized is presumed to indicate that it has successfully fetched data.

### Method `shutdown()`

Stop monitoring for updates.

### Method `status()`

Return an Object describing the current state of the Source instance

### Event `update`

Emitted when the source detects a change in its data

### Event `error`

Emitted when an error occurs in the underlying data source

## Class `Source.Polling`

Implements a periodic polling loop for stateless data sources. Implementations of `Polling` must generate and store their own state. The only method that implementations _must_ provide is `_fetch()`.

### Constructor `(parser, options, update)`

* extends `Source`
* parameter `options` {`Object`}
  * `interval`  {`Number`}  The interval at which to poll


### Private Method `_fetch(callback)`

The `_fetch()` method must be implemented by child classes. It is called by the polling loop to check for updates to remote data. The `_fetch()` method must be able to detect changes to the source that it is polling. The source-specific implementation must call `callback` with an error, `false` to signal that no update has occurred, or data if an update has occurred.

* parameter `callback(err, data)`  {`Function`} Called after an implementation-specific fetch task has completed. If no error has occurred and no update has occurred, the `data` operand must be `false`. Else, the data operand should contain new data to parse.
