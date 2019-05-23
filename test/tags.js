'use strict';

require('./lib/helpers');

const expect = require('chai').expect;
const AWS = require('aws-sdk-mock');
const AWS_SDK = require('aws-sdk');
const Tags = require('../dist/lib/source/tags');
const Parser = require('../dist/lib/source/tags/parser');
const sinon = require('sinon');
const nock = require('nock');

const metadataPaths = require('./data/metadata-paths.json');
const tagValues = {
  Tags: [
    { Key: 'Name', Value: 'service-name', ResourceType: 'instance', ResourceId: 'i-instanceid' },
    { Key: 'Service', Value: 'service-type', ResourceType: 'instance', ResourceId: 'i-instanceid' },
    { Key: 'This tag', Value: 'a value', ResourceType: 'instance', ResourceId: 'i-instanceid' },
    { Key: 'Another tag', Value: 'some other value', ResourceType: 'instance', ResourceId: 'i-instanceid' }
  ]
};

describe('Tags source plugin', function () {

  let metadataServiceSpy = sinon.spy();
  let ec2Spy = sinon.spy();

  before(function () {
    nock.disableNetConnect();
  });

  after(function () {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  beforeEach(function () {
    AWS.setSDKInstance(AWS_SDK);
  });

  afterEach(function () {
    AWS.restore();
    metadataServiceSpy.reset();
    ec2Spy.reset();
  });



  it('should parses tags into a useful object', function () {
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

  it('handles errors from the AWS Metadata SDK gracefully by not exposing the property', function () {
    AWS.mock('MetadataService', 'request', (path, callback) => {
      metadataServiceSpy();
      callback(new Error('some error from the AWS SDK'), null);
    });
    const source = new Tags({
      interval: 100
    });

    return source.initialize()
      .then(function () {
        expect(metadataServiceSpy.called).to.be.true;
        expect(source.properties).to.be.a('object');
        expect(source.properties).to.be.empty;
      });
  });

  it('should handle errors from the AWS EC2 SDK gracefully by not exposing the property', function () {
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
      .then(function () {
        expect(metadataServiceSpy.called).to.be.true;
        expect(ec2Spy.called).to.be.true;
        expect(source.properties).to.be.a('object');
        expect(source.properties).to.be.empty;
      });
  });

  it('should periodically fetches tag data', function () {
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
      .then(function () {
        ec2InitialCount = ec2Spy.callCount
        expect(source.properties.Name).to.be.a('string');
        expect(source.properties.Service).to.be.a('string');
        expect(source.properties['This tag']).to.be.a('string');
        expect(source.properties['Another tag']).to.be.a('string');

        expect(source.properties.Name).to.equal('service-name');
        expect(source.properties.Service).to.equal('service-type');
        expect(source.properties['This tag']).to.equal('a value');
        expect(source.properties['Another tag']).to.equal('some other value');
      })
      .then(function () {
        return new Promise((resolve) => { setTimeout(resolve, 1000) })
      })
      .then(function () {
        expect(ec2Spy.callCount).to.be.above(ec2InitialCount);
      });
  });
});
