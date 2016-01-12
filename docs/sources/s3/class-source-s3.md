## Sources.S3
The `Sources.S3` class initializes the component in the following order:

1. Initializes an instance of `Sources.S3.Store`.
1. Initializes an instance of `Sources.S3.Agent`.
1. Initializes an instance of `Utils.Timer` and starts it.

### Methods
* `constructor(bucket, path, interval, callback = null, args = {})`
	* `bucket`: `String // The S3 bucket`
	* `path`: `String // The path to the S3 object`
	* `interval`: `Int (in milliseconds) // Interval between invocation of {{callback}}`
	* `callback`: `Function (default is null) // Function invoked on expiration of {{interval}}`
	* `args`: `Object (default is {}) // Options to bind into the callback`
	
	 Using `args` allows context-specific variables, such as an event name to emit, to be passed into the callback.

* `createTimer()`
	* Creates a new `Utils.Timer` object with `this.interval` and `this.callback` or `Sources.S3.execute` (if `this.callback` is an empty object) as the arguments.
* `execute(options)`
	* `options`: 

		```javascript
		{
			agent: Sources.S3.Agent,
			store: Sources.S3.Store,
			args: {} // Optional 
			
		}
		```

		`execute()` is the default callback for `createTimer()` if one is not provided at instantiation.

### Public Properties
* `store`: instance of `Sources.S3.Store`
* `timer`: instance of `Utils.Timer`
* `agent`: instance of `Sources.S3.Agent`
