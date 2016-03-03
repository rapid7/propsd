# Source Interface

All source plugins must expose the following:

## Methods
1. A constructor that accepts an object of options. These options are source-specific and should be created based on the source documentation.

1. `Source#configure(params)`
1. `Source#initialize()`
1. `Source#status()`: (`Object`) Returns the plugin's status.
1. `Source#shutdown()`: Cleans up any open handles (fs, timer, etc.) the plugin has open.

## Properties
1. `Source#interval`: (`Integer`) The interval between execution attempts.
1. `Source#type`: (`String`) The source type. This is a static value for each source type.
1. `Source#name`: (`String`) A unique name comprised of `Source#type` and other information, such as the S3 bucket and key.
1. `Source#properties`: (`Object`) The properties retrieved and parsed from the source's underlying data.
1. `Source#service`: (`AWS.S3|AWS.MetadataService|Object`) The underlying service that retrieves data.

Specific source types have other exposed properties that are only specific to that plugin. For example, the `Metadata` source exposes `Metadata#signature` which is the sha1 signature of the `Metadata#properties` object used to prevent re-parsing if there's no change to the underlying data.

## Events
1. `startup`
1. `shutdown`
1. `update`: Emitted with an instance of the source plugin.
1. `no-update`
1. `error`: Emitted with an instance of `Error` describing what went wrong.
