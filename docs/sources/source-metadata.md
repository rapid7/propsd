Class: Source.Metadata
======================

Periodically fetch the local EC2 Metadata tree.

## Interface
### Instance Property: `properties`
The hash of properties retrieved from the Instance Metadata Service.

### Instance Property: `interval`
The timer interval.
```javascript
const m = new Metadata({
  interval: 300
});
m.interval // 300
```

### Instance Property: `name`
The unique name for the source instance. There should only be one Metadata source active at any given time.

### Instance Property: `service`
An instance of `AWS.MetadataService` used to query the Metadata tree.

### Instance Property: `signature`
A SHA-1 hash of the property data retrieved from the Instance Metadata Service. This is used to only emit the `update` event when new data is actually retrieved.

### Class Attribute: `type`
```
Metadata.type
```
The plugin type. Will always be set to `'ec2-metadata'`.

### Instance Method: `configure(params)`
Allows the plugin to be reconfigured on the fly. The `Source.Metadata` implementation only exposes the `interval` property.

### Instance Method: `initialize()`
Initializes a timer object and starts the first request to the Metadata endpoint.

### Instance Method: `shutdown()`
Clears the timer and emits the `shutdown` event.

### Instance Method: `status()`
Returns the status of the plugin instance.
```
{
  ok: true|false, // True if the instance is working correctly
  updated: Date, // Last updated
  interval: Timer, // The timer instance
  running: true|false // True if the plugin has been initialized
};
```

### Static Method: `setIfChanged(scope, key, value)`
Helper method to detect parameter changes. This works together with the `configure()` method to allow an instance `interval` to be changed after creation.

### Event `shutdown`
Issued after the timer is cleared when the `shutdown()` method is called.

### Event `update`
Issued whenever `properties` has been updated. The plugin manager should subscribe to this event in order to marshall up-to-date data to the `Storage` object.

### Event `error`
Issued whenever an error occurs. Only emitted if there are error handlers set to handle it in order to avoid an uncaught exception.

### Event `no-update`
Issued on each successful run in which there is no updated data.
