# Propsd S3 Plugin

## Purpose
The S3 Plugin manages retrieving data from S3. On a set interval the plugin will send a request using the aws-sdk to a config object in S3, determine if the object has been updated more recently than the previously retrieved object, and, if so, will retrieve the new object, parse its `Body`, and emit an event for the storage layer to consume.

## High level composition
The watcher component will be split into the following modules:

  * `S3`
  * `S3.Agent`
  * `S3.Store`
  * `S3.Parser`

## Classes

* [Sources.S3](s3/class-source-s3.md)
* [Sources.S3.Agent](s3/class-source-s3-agent.md)
* [Sources.S3.Store](s3/class-source-s3-store.md)
* [Sources.S3.Parser](s3/class-source-s3-parser.md)