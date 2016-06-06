'use strict';
const Path = require('path');

/**
 * Metadata Parser
 *
 * @class MetadataParser
 *
 */
class Parser {
  constructor(options) {
    this.properties = {};
    this.namespace = options.namespace;
  }

  update(data) {
    const properties = {};

    // Get region and account ID from the ID document
    try {
      const identity = JSON.parse(data['dynamic/instance-identity/document']);

      properties.account = identity.accountId;
      properties.region = identity.region;
    } catch (e) {
      /* Don't do anything */
    }

    // Expose instance identification parameters
    properties.identity = {
      document: data['dynamic/instance-identity/document'],
      dsa2048: data['dynamic/instance-identity/dsa2048'],
      pkcs7: data['dynamic/instance-identity/pkcs7'],
      signature: data['dynamic/instance-identity/signature']
    };

    // Get instance profile credentials
    const IAM_METADATA_PATH = 'meta-data/iam/security-credentials/';
    const credentialsPaths = Object.keys(data).filter((path) =>
    Path.relative(IAM_METADATA_PATH, path).slice(0, 2) !== '..');

    // Use the first set of credentials
    if (credentialsPaths.length > 0) {
      try {
        const credentials = JSON.parse(data[credentialsPaths[0]]);

        properties.credentials = {
          lastUpdated: credentials.LastUpdated,
          type: credentials.Type,
          accessKeyId: credentials.AccessKeyId,
          secretAccessKey: credentials.SecretAccessKey,
          expires: credentials.Expiration
        };
      } catch (e) {
        /* Don't do anything */
      }
    }

    // Common meta-data properties
    ['local-ipv4', 'local-hostname', 'instance-type', 'instance-id', 'hostname',
      'ami-id', 'public-hostname', 'public-ipv4', 'public-keys', 'reservation-id',
      'security-groups'].forEach((name) => properties[name] = data[Path.join('meta-data', name)]);

    properties['availability-zone'] = data['meta-data/placement/availability-zone'];

    // Grok the network interface parameters
    const mac = data['meta-data/mac'];

    if (mac) {
      const interfacePath = Path.join('meta-data/network/interfaces/macs', mac);

      properties['vpc-id'] = data[Path.join(interfacePath, 'vpc-id')];
      properties['subnet-id'] = data[Path.join(interfacePath, 'subnet-id')];

      const interfaceProperties = properties.interface = {};

      ['vpc-ipv4-cidr-block', 'subnet-ipv4-cidr-block', 'public-ipv4s', 'mac',
        'local-ipv4s', 'interface-id'
      ].forEach((name) => interfaceProperties[name] = data[Path.join(interfacePath, name)]);
    }

    this.properties = properties;
  }
}
module.exports = Parser;
