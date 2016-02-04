/* eslint-disable no-param-reassign */
'use strict';

const Crypto = require('crypto');
const Path = require('path');

const Source = require('./index');
const Parser = require('../parser');

const DEFAULT_PARALLEL = 16;
const METADATA_LIST = /^(\d+)=(.+)$/;
const METADATA_TIMEOUT = 500;

/**
 * Iterate over a list of tasks in parallel, passing one to each call of the
 * `work` function. When all tasks are complete, or an error is encountered, call the
 * `done` function, with an error if one occured.
 *
 * This implementation iterates over a work-list non-destructivly, without cloning it.
 * meaning that more tasks can be added safely while the work-loop is running.
 *
 * @param  {Array}    list    Set of tasks to work on
 * @param  {Function} work    The operation to perfrom on each element of `list`
 * @param  {Function} done    Callback on error or completion
 * @param  {Object}   state { parallel: Number limit parallel tasks. Default 16 }
 */
function each(list, work, done, state) {
  state = state || {
    parallel: DEFAULT_PARALLEL,
    error: false
  };

  // Default values
  if (!Number(state.running)) state.running = 0;
  if (!Number(state.cursor)) state.cursor = 0;

  // No more items to process
  if (state.cursor >= list.length) {
    // Call done if this was the last branch
    if (state.running === 0 && !state.error) done();

    return;
  }

  // Already enough tasks in flight
  if (state.running >= state.parallel) return;

  // Get an item off of the list, move up the cursor, and get a semaphore.
  const item = list[state.cursor];

  // Obtain a semaphore
  state.running += 1;
  state.cursor += 1;

  // Branch parallel requests
  while (state.running < state.parallel &&
         state.cursor < list.length) each(list, work, done, state);

  // Process this branch's task
  work(item, function (err) {
    // Release the semaphore
    state.running -= 1;

    // An error has occured. Just bail.
    if (state.error) return;

    if (err) {
      state.error = true;
      return done(err); // eslint-disable-line consistent-return
    }

    // Iterate
    each(list, work, done, state);
  });
}

/**
 * Metadata Source
 *
 * Expose EC2 metadata to the proeprty-set
 *
 * @class Source.Metadata
 * @extends Source
 *
 * @param {Parser} parser
 * @param {Object} options
 *      - {Number} interval Polling interval. Default 30s.
 */
class Metadata extends Source.Polling {
  constructor(options, update) {
    options = options || {};
    if (!options.hasOwnProperty('name')) options.name = 'ec2-metadata';
    if (!options.hasOwnProperty('namespace')) options.namespace = 'instance';

    super(Metadata.Parser, options, update);

    this.signature = null;
  }

  _fetch(callback) {
    const _this = this;

    this.constructor.traverse(function (err, data) {
      if (err) return callback(err);

      // Detect change by hashing the fetched data
      const hash = Crypto.createHash('sha1');
      Object.keys(data).sort().forEach((key) => hash.update(key + ':' + data[key]));

      const signature = hash.digest('base64');
      if (_this.signature === signature) return callback(null, false);

      _this.signature = signature;
      callback(null, data);
    });
  }

  /**
   * Metadata.traverse
   *
   * Fetch all values from the EC2 matadata tree
   *
   * @param  {Function} callback(err, paths) Return an error or a hash of paths and their values
   */
  static traverse(callback) {
    const _this = this;
    const timer = Date.now();
    const values = {};
    const paths = ['/meta-data/', '/dynamic/'];

    each(paths, function (path, next) {
      _this.service.request(Path.join('/', _this.version, path), function (err, data) {
        if (err) return next(err);

        // This is a list! Split new-line delimited strings into an array and add to tail of paths
        if (path.slice(-1) === '/') {
          const items = data.trim().split('\n');

          // Is this a list?
          if (items.reduce((memo, item) => memo && METADATA_LIST.test(item), true)) {
            const list = values[path.slice(1, -1)] = [];

            items.forEach(function (item) {
              const match = item.match(METADATA_LIST);
              if (match) list[match[1]] = match[2];
            });

            return next();
          }

          items.forEach((node) => paths.push(Path.join(path, node)));
          return next();
        }

        // Remove leading `/`
        values[path.slice(1)] = data;
        next();
      });
    }, (err) => callback(err, values));
  }
}

Metadata.version = 'latest';
Metadata.type = 'ec2-metadata';
Source.register(Metadata);

/**
 * Initialize the metadata-service client
 */
Metadata.service = new (require('aws-sdk').MetadataService)({
  httpOptions: {
    timeout: METADATA_TIMEOUT
  },
  host: Config.get('metadata:host')
});

/**
 * Metadata Parser
 *
 * @class Source.Metadata.Parser
 * @extends Parser
 *
 */
class MetadataParser extends Parser.Properties {
  constructor(source, options) {
    super(source, options);
    this.namespace = options.namespace;
  }

  update(data) {
    const _this = this;
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

    this.properties = {};
    this.properties[_this.namespace] = properties;
  }
}

/* Export */
module.exports = Metadata;
Metadata.Parser = MetadataParser;
