'use strict';

require('./lib/helpers');

const should = require('should');
const sinon = require('sinon');
const nock = require('nock');
const AWS_MOCK = require('aws-sdk-mock');
const AWS_SDK = require('aws-sdk');

const Metadata = require('../src/lib/source/metadata');
const Parser = require('../src/lib/source/metadata/parser');
const Util = require('../src/lib/source/metadata/util');

describe('Metadata traversals / parsing', function() {
  const metadataPaths = require('./data/metadata-paths.json');
  const metadataValues = require('./data/metadata-values.json');

  it('should travarse metadata paths successfully', function(done) {
    Util.traverse('latest', Parser.paths,
      function(path, callback) {
        callback(null, metadataPaths[path]);
      },
      function(err, data) {
        if (err) {
          return done(err);
        }

        data.should.eql(metadataValues);
        done();
      });
  });

  it('should parse traversed values into a useful object', function() {
    const parser = new Parser();

    parser.update(metadataValues);

    // Currently used in our Index object.
    parser.properties.account.should.be.a.String();
    parser.properties.region.should.be.a.String();
    parser.properties['iam-role'].should.eql('fake-fake');
    parser.properties['vpc-id'].should.be.a.String();
    parser.properties['instance-id'].should.be.a.String();

    parser.properties.identity.should.be.an.Object();
    parser.properties.credentials.should.be.an.Object();
    parser.properties.interface.should.be.an.Object();
  });

  it('should not display values that are undefined', function() {
    const parser = new Parser();
    const deletedMetadataValues = Object.assign({}, metadataValues);

    deletedMetadataValues['meta-data/instance-id'] = undefined;
    deletedMetadataValues['dynamic/instance-identity/document'] = undefined;

    parser.update(deletedMetadataValues);
    parser.properties.should.not.have.property('instance-id');
    parser.properties.identity.should.not.have.property('document');
    parser.properties.should.not.have.property('account');
    parser.properties.should.not.have.property('region');
  });
});

describe('Metadata / ASG API calls', function() {
  const metadataPaths = require('./data/metadata-paths.json');

  let metadataServiceSpy = sinon.spy();

  let asgSpy = sinon.spy();

  before(function() {
    nock.disableNetConnect();
  });

  beforeEach(function() {
    AWS_MOCK.setSDKInstance(AWS_SDK);
  });

  afterEach(function() {
    AWS_MOCK.restore();
    metadataServiceSpy.resetHistory();
    asgSpy.resetHistory();
  });

  after(function() {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it('should handle AWS MetaDataService error from the AWS SDK gracefully by not exposing the property', function() {
    AWS_MOCK.mock('MetadataService', 'request', function(path, callback) {
      metadataServiceSpy();
      callback(new Error('some error from the AWS SDK'), null);
    });

    const source = new Metadata({
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

  it('should handle ASG errors from the AWS SDK by not surfacing the auto-scaling-group property', function() {
    AWS_MOCK.mock('MetadataService', 'request', function(path, callback) {
      metadataServiceSpy();
      callback(null, metadataPaths[path]);
    });

    AWS_MOCK.mock('AutoScaling', 'describeAutoScalingInstances', function(params, callback) {
      asgSpy();
      callback(new Error('some error from the AWS SDK'), null);
    });

    const source = new Metadata({
      interval: 100
    });

    return source.initialize()
      .then(() => {
        metadataServiceSpy.called.should.be.true();
        asgSpy.calledOnce.should.be.true();
        should(source.properties['auto-scaling-group']).be.undefined();

        source.stop();
      });
  });

  it('should retrieve ASG info for the instance', function() {
    AWS_MOCK.mock('MetadataService', 'request', function(path, callback) {
      metadataServiceSpy();
      callback(null, metadataPaths[path]);
    });

    AWS_MOCK.mock('AutoScaling', 'describeAutoScalingInstances', function(params, callback) {
      asgSpy();
      callback(null, {
        AutoScalingInstances: [{
          AutoScalingGroupName: 'my-cool-auto-scaling-group'
        }]
      });
    });

    const source = new Metadata({
      interval: 100
    });

    return source.initialize()
      .then(() => {
        metadataServiceSpy.called.should.be.true();
        asgSpy.calledOnce.should.be.true();
        source.properties.account.should.be.a.String();
        source.properties.region.should.be.a.String();
        source.properties['vpc-id'].should.be.a.String();
        source.properties['iam-role'].should.eql('fake-fake');
        source.properties['instance-id'].should.be.a.String();
        source.properties.identity.should.be.an.Object();
        source.properties.credentials.should.be.an.Object();
        source.properties.interface.should.be.an.Object();
        source.properties['auto-scaling-group'].should.be.a.String();
        source.properties['auto-scaling-group'].should.eql('my-cool-auto-scaling-group');

        source.stop();
      });
  });

  it('periodically fetches metadata / ASG info from the EC2 metadata / ASG API', function() {
    AWS_MOCK.mock('MetadataService', 'request', function(path, callback) {
      metadataServiceSpy();
      callback(null, metadataPaths[path]);
    });

    AWS_MOCK.mock('AutoScaling', 'describeAutoScalingInstances', function(params, callback) {
      asgSpy();
      callback(null, {AutoScalingInstances: []});
    });

    const source = new Metadata({
      interval: 100
    });

    let metadataInitialCallCount;

    return source.initialize()
      .then(() => {
        metadataInitialCallCount = metadataServiceSpy.callCount;
        metadataServiceSpy.called.should.be.true();
        asgSpy.calledOnce.should.be.true();
      })
      .then(() => new Promise((resolve) => {
        setTimeout(resolve, 1000);
      }))
      .then(() => {
        metadataServiceSpy.callCount.should.be.above(metadataInitialCallCount);
        asgSpy.calledOnce.should.be.false();

        source.stop();
      });
  });

  it('should only retrieve ASG data once', function() {
    AWS_MOCK.mock('MetadataService', 'request', function(path, callback) {
      callback(null, metadataPaths[path]);
    });

    AWS_MOCK.mock('AutoScaling', 'describeAutoScalingInstances', function(params, callback) {
      asgSpy();
      callback(null, {
        AutoScalingInstances: [{
          AutoScalingGroupName: 'my-cool-auto-scaling-group'
        }]
      });
    });

    const source = new Metadata({
      interval: 100
    });

    return source.initialize()
      .then(() => {
        asgSpy.calledOnce.should.be.true();
      })
      .then(() => new Promise((resolve) => {
        setTimeout(resolve, 1000);
      }))
      .then(() => {
        asgSpy.calledOnce.should.be.true();

        source.stop();
      });
  });
});
