## Utils.Timer
`Utils.Timer` wraps a call to `setInterval()`. On `timer` expiration, it will invoke the `callback`.

All `Sources` that rely on timed checks should implement `Utils.Timer`'s interface.

### Methods
* `constructor(interval, callback, args = {})`
* `clear()`
	* Clears the timer
