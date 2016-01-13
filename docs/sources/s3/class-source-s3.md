## Sources.S3
The `Sources.S3` class initializes the component in the following order:

1. Initializes an instance of `Sources.S3.Store`.
1. Initializes an instance of `Sources.S3.Agent`.
1. Creates an `intervalObject` that executes the callback ever `{{interval}}` milliseconds

### Methods
* `constructor(bucket, path, interval)`
	* `bucket`: (`string`) The S3 bucket
	* `path`: (`string`) The path to the S3 object
	* `interval`: (`int`) Interval between invocation of {{callback}} (in milliseconds)

* `getName()`
	* Returns a unique name for the plugin instance

* `getType()`
	* Returns the plugin type (S3)

* `fetch(callback = null, args = {})`
	* `callback`: (`Function`) Function invoked on expiration of {{interval}} (default is null)
	* `args`: (`Object`) Options to bind into the callback (default is {})

		Creates a timer that executes every `{{interval}}` milliseconds.

* `defaultFetch(options)`
	* `options`: 

		```javascript
		{
			agent: (Sources.S3.Agent),
			store: (Sources.S3.Store),
			args: (Object)
			
		}
		```

		`defaultFetch()` is the default callback for `fetch()` if one is not provided.

### Properties
* `_bucket`: (`string`) The S3 bucket
* `_path`: (`string`) The path to the S3 object
* `_interval`: (`int`) Interval between invocations of the callback provided to fetch()`
* `_store`: (`Sources.S3.Store`)
* `_agent`: (`Sources.S3.Agent`)
* `_timer`: (`intervalObject `)