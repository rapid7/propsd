## Sources.S3.Parser
Parser is the class that will translate strings (starting with yamal) into properties (json) between storage and services

### Methods
* `constructor(properties)`

* `toJson(properties)`
  * `properties`: (`buffer`) unformatted buffer of properties
  * returns the buffer of properties formatted in json that the services can read.
