Class: Source.Metadata
======================

Periodically fetch the local EC2 Metadata tree

## Interface

### Class Method: `traverse(callback)`

Walk the EC2 Metadata tree, fetching values. The `callback(err, paths)` nmethod returns an error, or a hash of paths and their values, e.g.

```json
{
  "instance.public-hostname": "",
  "instance.profile": "default-hvm",
  "instance.mac": "06:27:80:9b:0e:37",
  "instance.local-ipv4": "172.16.132.25",
  "instance.local-hostname": "ip-172-16-132-25.us-west-2.compute.internal",
  "instance.instance-type": "t2.micro",
  "instance.instance-id": "i-133306ca",
  ...
  "instance.network.interfaces.macs.06:27:80:9b:0e:37.vpc-ipv4-cidr-block": "172.16.132.0/24",
  "instance.network.interfaces.macs.06:27:80:9b:0e:37.vpc-id": "vpc-36b1b053",
  "instance.network.interfaces.macs.06:27:80:9b:0e:37.subnet-ipv4-cidr-block": "172.16.132.16/28",
  ...
}
```

### TODO: Complete when the Source interfce has been defined
