'use strict';

require('./lib/helpers');
require('should');

const AWS = require('aws-sdk-mock');
const AWS_SDK = require('aws-sdk');
const Tags = require('../src/lib/source/tags');
const Parser = require('../src/lib/source/tags/parser');
const sinon = require('sinon');
const nock = require('nock');

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
  let metadataServiceSpy = sinon.spy();

  let ec2Spy = sinon.spy();

  before(function() {
    nock.disableNetConnect();
  });

  after(function() {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  beforeEach(function() {
    AWS.setSDKInstance(AWS_SDK);
  });

  afterEach(function() {
    AWS.restore();
    metadataServiceSpy.reset();
    ec2Spy.reset();
  });

  it('should parses tags into a useful object', function() {
    const parser = new Parser();

    parser.update(tagValues);
    parser.properties.Name.should.be.a.String();
    parser.properties.Service.should.be.a.String();
    parser.properties['This tag'].should.be.a.String();
    parser.properties['Another tag'].should.be.a.String();

    parser.properties.Name.should.eql('service-name');
    parser.properties.Service.should.eql('service-type');
    parser.properties['This tag'].should.eql('a value');
    parser.properties['Another tag'].should.eql('some other value');
  });

  it('handles errors from the AWS Metadata SDK gracefully by not exposing the property', function() {
    AWS.mock('MetadataService', 'request', (path, callback) => {
      metadataServiceSpy();
      callback(new Error('some error from the AWS SDK'), null);
    });
    const source = new Tags({
      interval: 100
    });

    return source.initialize()
      .then(() => {
        metadataServiceSpy.called.should.be.true();
        source.properties.should.be.an.Object();
        source.properties.should.be.empty();
        source.stop();
      });
  });

  it('should handle errors from the AWS EC2 SDK gracefully by not exposing the property', function() {
    AWS.mock('MetadataService', 'request', (path, callback) => {
      metadataServiceSpy();
      callback(null, metadataPaths[path]);
    });

    AWS.mock('EC2', 'describeTags', (path, callback) => {
      ec2Spy();
      callback(new Error('some error from the AWS SDK'), null);
    });

    const source = new Tags({
      interval: 100
    });

    return source.initialize()
      .then(() => {
        metadataServiceSpy.called.should.be.true();
        ec2Spy.called.should.be.true();
        source.properties.should.be.an.Object();
        source.properties.should.be.empty();
        source.stop();
      });
  });

  it('should periodically fetches tag data', function() {
    // this.timeout(2500);

    // Stub the AWS.MetadataService request method
    AWS.mock('MetadataService', 'request', (path, callback) => {
      metadataServiceSpy();
      callback(null, metadataPaths[path]);
    });

    AWS.mock('EC2', 'describeTags', (path, callback) => {
      ec2Spy();
      callback(null, tagValues);
    });

    const source = new Tags({
      interval: 100
    });

    let ec2InitialCount;

    return source.initialize()
      .then(() => {
        ec2InitialCount = ec2Spy.callCount;
        source.properties.Name.should.be.a.String();
        source.properties.Service.should.be.a.String();
        source.properties['This tag'].should.be.a.String();
        source.properties['Another tag'].should.be.a.String();

        source.properties.Name.should.eql('service-name');
        source.properties.Service.should.eql('service-type');
        source.properties['This tag'].should.eql('a value');
        source.properties['Another tag'].should.eql('some other value');
      })
      .then(() => new Promise((resolve) => {
        setTimeout(resolve, 1000);
      }))
      .then(() => {
        ec2Spy.callCount.should.be.above(ec2InitialCount);
        source.stop();
      });
  });
});
