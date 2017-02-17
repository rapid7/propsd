## Sources.S3.Parser
Parser is the module that will translate and flatten buffers into properties between storage (S3) and services.

### Methods
* `constructor(properties)`

* `getData(properties)`
  * `properties`: (`buffer`) unformatted buffer of properties
  * returns a buffer of properties formatted and munged down to one level.
