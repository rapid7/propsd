'use strict';
const Path = require('path');

/* eslint-disable no-param-reassign */

/**
 * Metadata Parser
 *
 * @class MetadataParser
 *
 */
class Parser {
  /**
   * Constructor
   */
  constructor() {
    this.properties = {};
  }

  /**
   * Parse the property set and update the parser's properties and sources
   * @param {Object} data
   */
  update(data) {
    const properties = {};

    // Call mapping functions
    Object.keys(Parser.mappings).forEach((path) => {
      Parser.mappings[path](path, data, properties);
    });

    // Sweep out undefined values
    Object.keys(properties).forEach((prop) => {
      if (typeof properties[prop] === 'undefined') {
        delete properties[prop];
      }
    });

    this.properties = properties;
  }

  /**
   * Get relevant metadata paths
   * @return {Array}
   */
  static get paths() {
    return Object.keys(this.mappings);
  }
}
module.exports = Parser;

/**
 * Helper to insert a value from a metadata path at it's basename in properties
 *
 * @param  {String} path       The property's Metadata API path
 * @param  {Object} metadata   Path/value mappings fro the Metadata API
 * @param  {Object} properties The properties object
 */
function atBasename(path, metadata, properties) {
  properties[Path.basename(path)] = metadata[path];
}

/**
 * Map Metadata API paths to properties.
 *
 * @type {Object}
 */
Parser.mappings = {
  'meta-data/ami-id': atBasename,
  'meta-data/placement/availability-zone': atBasename,
  'meta-data/hostname': atBasename,
  'meta-data/instance-id': atBasename,
  'meta-data/instance-type': atBasename,
  'meta-data/local-ipv4': atBasename,
  'meta-data/local-hostname': atBasename,
  'meta-data/public-hostname': atBasename,
  'meta-data/public-ipv4': atBasename,
  'meta-data/reservation-id': atBasename,
  'meta-data/security-groups': atBasename,

  'dynamic/instance-identity/document': (path, metadata, properties) => {
    // Return early if there's no data here
    if (!metadata[path]) {
      return;
    }

    if (!properties.identity) {
      properties.identity = {};
    }

    properties.identity.document = metadata[path];
    const identity = JSON.parse(metadata[path]);

    properties.account = identity.accountId;
    properties.region = identity.region;
  },
  'dynamic/instance-identity/pkcs7': (path, metadata, properties) => {
    // Return early if there's no data here
    if (!metadata[path]) {
      return;
    }

    if (!properties.identity) {
      properties.identity = {};
    }

    properties.identity.pkcs7 = metadata[path];
  },

  'meta-data/iam/security-credentials/': (path, metadata, properties) => {
    const match = new RegExp('^' + path);
    const roles = Object.keys(metadata).filter((p) => match.test(p));

    // Instance does not have a Profile/Role
    if (roles.length === 0) {
      return;
    }

    properties['iam-role'] = Path.basename(roles[0]);
    const credentials = JSON.parse(metadata[roles[0]]);

    if (!properties.credentials) {
      properties.credentials = {};
    }

    properties.credentials.lastUpdated = credentials.LastUpdated;
    properties.credentials.type = credentials.Type;
    properties.credentials.accessKeyId = credentials.AccessKeyId;
    properties.credentials.secretAccessKey = credentials.SecretAccessKey;
    properties.credentials.expires = credentials.Expiration;
  },

  'meta-data/mac': () => {},
  'meta-data/network/interfaces/macs/': (path, metadata, properties) => {
    const mac = metadata['meta-data/mac'];

    // Return early if there's no data here
    if (!mac) {
      return;
    }

    if (!properties.interface) {
      properties.interface = {};
    }

    [
      'vpc-ipv4-cidr-block',
      'subnet-ipv4-cidr-block',
      'public-ipv4s',
      'mac',
      'local-ipv4s',
      'interface-id'
    ].forEach((key) => {
      properties.interface[key] = metadata[Path.join(path, mac, key)];
    });

    properties['vpc-id'] = metadata[Path.join(path, mac, 'vpc-id')];
  },
  'auto-scaling-group': atBasename
};
