'use strict';

require('./lib/helpers');

const expect = require('chai').expect;
const AWS = require('aws-sdk-mock');

const Tags = require('../lib/source/tags');
const Parser = require('../lib/source/tags/parser');

const metadataPaths = require('./data/metadata-paths.json');
const tagValues = {
  Tags: [
    {Key: 'Name', Value: 'service-name', ResourceType: 'instance', ResourceId: 'i-instanceid'},
    {Key: 'Service', Value: 'service-type', ResourceType: 'instance', ResourceId: 'i-instanceid'},
    {Key: 'This tag', Value: 'a value', ResourceType: 'instance', ResourceId: 'i-instanceid'},
    {Key: 'Another tag', Value: 'some other value', ResourceType: 'instance', ResourceId: 'i-instanceid'}
  ]
};

describe('Tags source plugin', function() {
  it('parses tags into a useful object', function() {
    const parser = new Parser();

    parser.update(tagValues);
    expect(parser.properties.Name).to.be.a('string');
    expect(parser.properties.Service).to.be.a('string');
    expect(parser.properties['This tag']).to.be.a('string');
    expect(parser.properties['Another tag']).to.be.a('string');

    expect(parser.properties.Name).to.equal('service-name');
    expect(parser.properties.Service).to.equal('service-type');
    expect(parser.properties['This tag']).to.equal('a value');
    expect(parser.properties['Another tag']).to.equal('some other value');
  });

  it('handles errors from the AWS Metadata SDK gracefully by not exposing the property', function(done) {
    AWS.mock('MetadataService', 'request', (path, callback) => {
      callback(new Error('some error from the AWS SDK'), null);
    });
    const source = new Tags({
      interval: 100
    });

    source.once('update', () => {
      expect(source.properties).to.be.a('object');
      expect(source.properties).to.be.empty;

      AWS.restore();
      done();
    });
    source.initialize();
  });

  it('handles errors from the AWS EC2 SDK gracefully by not exposing the property', function(done) {
    AWS.mock('MetadataService', 'request', (path, callback) => {
      callback(null, metadataPaths[path]);
    });

    AWS.mock('EC2', 'describeTags', (path, callback) => {
      callback(new Error('some error from the AWS SDK'), null);
    });

    const source = new Tags({
      interval: 100
    });

    source.once('update', () => {
      expect(source.properties).to.be.a('object');
      expect(source.properties).to.be.empty;

      AWS.restore();
      done();
    });
    source.initialize();
  });

  it('periodically fetches tag data', function(done) {
    this.timeout(2500);

    // Stub the AWS.MetadataService request method
    AWS.mock('MetadataService', 'request', (path, callback) => {
      callback(null, metadataPaths[path]);
    });

    AWS.mock('EC2', 'describeTags', (path, callback) => {
      callback(null, tagValues);
    });

    const source = new Tags({
      interval: 100
    });

    source.once('update', () => {
      // Currently used in our Index object.
      expect(source.properties.Name).to.be.a('string');
      expect(source.properties.Service).to.be.a('string');
      expect(source.properties['This tag']).to.be.a('string');
      expect(source.properties['Another tag']).to.be.a('string');

      expect(source.properties.Name).to.equal('service-name');
      expect(source.properties.Service).to.equal('service-type');
      expect(source.properties['This tag']).to.equal('a value');
      expect(source.properties['Another tag']).to.equal('some other value');

      source.once('noupdate', () => {
        expect(source.state).to.equal(Tags.RUNNING);
        source.shutdown();

        AWS.restore();
        done();
      });
    });

    source.initialize();
  });
});
