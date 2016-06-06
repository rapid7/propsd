'use strict';

/* eslint-env mocha */
/* global Config, Log */
/* eslint-disable max-nested-callbacks */

require('./lib/helpers');

const expect = require('chai').expect;

const Metadata = require('../lib/source/metadata');
const Parser = require('../lib/source/metadata/parser');
const Util = require('../lib/source/metadata/util');

describe('Metadata source plugin', function _() {
  const metadataPaths = require('./data/metadata-paths.json');
  const metadataValues = require('./data/metadata-values');

  it('traverses metadata paths', function __(done) {
    Util.traverse(
      'latest',
      ['/meta-data/', '/dynamic/'],
      (path, cb) => cb(null, metadataPaths[path]),
      (err, data) => {
        if (err) { return done(err); }

        expect(data).to.eql(metadataValues);
        done();
      }
    );
  });

  it('parses traversed values into a useful object', function __() {
    const parser = new Parser();

    parser.update(metadataValues);

    // Currently used in our Index object.
    expect(parser.properties.account).to.be.a('string');
    expect(parser.properties.region).to.be.a('string');
    expect(parser.properties['vpc-id']).to.be.a('string');
    expect(parser.properties['instance-id']).to.be.a('string');

    expect(parser.properties.identity).to.be.an('object');
    expect(parser.properties.credentials).to.be.an('object');
    expect(parser.properties.interface).to.be.an('object');
  });

  it('periodically fetches metadata from the EC2 metadata API', function __(done) {
    const source = new Metadata();

    // Stub the AWS.MetadataService request method
    source.service = {
      request: function request(path, callback) {
        callback(null, metadataPaths[path]);
      }
    };

    source.on('update', () => {
      // Currently used in our Index object.
      expect(source.properties.account).to.be.a('string');
      expect(source.properties.region).to.be.a('string');
      expect(source.properties['vpc-id']).to.be.a('string');
      expect(source.properties['instance-id']).to.be.a('string');

      expect(source.properties.identity).to.be.an('object');
      expect(source.properties.credentials).to.be.an('object');
      expect(source.properties.interface).to.be.an('object');

      source.shutdown();
      done();
    });

    source.initialize();
  });
});
