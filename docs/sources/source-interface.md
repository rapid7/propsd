# Source Interface

All source plugins must expose the following:

## Methods
1. A constructor that accepts a path to a given resource. That resource can be local or remote as long as the plugin itself understands how to parse the path and retrieve the data. Additional arguments are acceptable as long as the index document contains information to fill in the remaining arguments.
1. `getName()`: (`string`) Returns a unique name for the plugin instance.
	
	In the S3 source, for example, `getName()` returns a string comprised of the plugin type, the resource bucket, and the resource path.
	
1. `getType()`: (`string`) Returns the plugin type.
1. `fetch(callback, args)` Executes the callback with the given `args`. 

	Built-in plugins have a `defaultFetch(options)` method that provides a default callback. For instance, the S3 plugin can be executed simply by calling `s3.fetch()`.
	
1. `status()`: (`Object`) Returns the plugin's status.
1. `shutdown()`: Cleans up any open handles (fs, timer, etc.) the plugin has open.

## Events
1. `source-done`: Emitted with:
	* `type`: (`string`) The source type (see `getType()`)
	* `name`: (`string`) The source name (see `getName()`)
	* `data`: (`Object`) The parsed payload returned from the source.

1. `source-err`: Emitted with:
	* `type`: (`string`) The source type (see `getType()`)
	* `name`: (`string`) The source name (see `getName()`)
	* `err`: (`Error`) An instance of `Error` containing information about the error.