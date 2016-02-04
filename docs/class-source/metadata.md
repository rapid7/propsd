Class: Source.Metadata
======================

Periodically fetch the local EC2 Metadata tree. Metadata implements `Source.Polling`. It uses a SHA1 hash to detect changes to the raw fetched parameters.

### Class Attribute `service`

An instance of AWS.MetadataService from the `aws-sdk`

### Class Attribute `version`

The API version of the Metadata service to query

### Class Attribute `type`

Static value `ec2-metadata`

### Class Method `traverse(callback)`

Walk the EC2 Metadata tree, fetching values. The `callback(err, paths)` method returns an error, or a hash of paths and their values:

```json
{
  "instance/public-hostname": "",
  "instance/profile": "default-hvm",
  "instance/mac": "06:27:80:9b:0e:37",
  "instance/local-ipv4": "172.16.132.25",
  "instance/local-hostname": "ip-172-16-132-25.us-west-2.compute.internal",
  "instance/instance-type": "t2.micro",
  "instance/instance-id": "i-133306ca",
  ...
  "instance/network/interfaces/macs/06:27:80:9b:0e:37/vpc-ipv4-cidr-block": "172.16.132.0/24",
  "instance/network/interfaces/macs/06:27:80:9b:0e:37/vpc-id": "vpc-36b1b053",
  "instance/network/interfaces/macs/06:27:80:9b:0e:37/subnet-ipv4-cidr-block": "172.16.132.16/28",
  ...
}
```

### Private Method `_fetch(callback)`

Call `traverse` to fetch all paths in the metadata API tree. Hash each path and its value to detect changes.

## Class Metadata.Parser

An implementation of `Parser.Properties` that converts the fetched Object of path/value pairs into an Object of useful properties:

```json
{
  "<Attribute `namespace`>": {
    "account": "Account ID",
    "region": "AWS Region",
    "identity": {
      "document": "Instance identity document. See http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-identity-documents.html",
      "dsa2048": "Signature",
      "pkcs7": "Signature",
      "signature": "Signature"
    },
    "credentials": {
      "lastUpdated": "Date",
      "type": "AWS hash type",
      "accessKeyId": "IAM Key",
      "secretAccessKey": "IAM Key",
      "expires": "Date"
    },
    "EC2 Property": "Values. e.g availability-zone, instance-id, instance-type, etc,",
    "interface": {
      "vpc-ipv4-cidr-block": "10.196.0.0/18",
      "subnet-ipv4-cidr-block": "10.196.24.0/25",
      "public-ipv4s": "54.172.233.251",
      "mac": "0e:9c:a1:fe:2f:ef",
      "local-ipv4s": "10.196.24.63",
      "interface-id": "eni-49685b15"
    }
  }
}
```

### Attribute `namespace`

A String value at which Metadata properties should be attached in the output Object
