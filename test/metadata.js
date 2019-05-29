'use strict';

require('./lib/helpers');

const expect = require('chai').expect;
const sinon = require('sinon');
const nock = require('nock');
const AWS_MOCK = require('aws-sdk-mock');
const AWS_SDK = require('aws-sdk');

const Metadata = require('../dist/lib/source/metadata');
const Parser = require('../dist/lib/source/metadata/parser');
const Util = require('../dist/lib/source/metadata/util');

describe('Metadata traversals / parsing', function () {
  const metadataPaths = require('./data/metadata-paths.json');
  const metadataValues = require('./data/metadata-values.json');

  it('should travarse metadata paths successfully', function (done) {
    Util.traverse('latest', Parser.paths,
      function (path, callback) {
        callback(null, metadataPaths[path])
      },
      function (err, data) {
        if (err) {
          return done(err);
        }

        expect(data).to.eql(metadataValues);
        done();
      });
  });

  it('should parse traversed values into a useful object', function () {
    const parser = new Parser();

    parser.update(metadataValues);

    // Currently used in our Index object.
    expect(parser.properties.account).to.be.a('string');
    expect(parser.properties.region).to.be.a('string');
    expect(parser.properties['iam-role']).to.eq('fake-fake');
    expect(parser.properties['vpc-id']).to.be.a('string');
    expect(parser.properties['instance-id']).to.be.a('string');

    expect(parser.properties.identity).to.be.an('object');
    expect(parser.properties.credentials).to.be.an('object');
    expect(parser.properties.interface).to.be.an('object');
  });

  it('should not display values that are undefined', function () {
    const parser = new Parser();
    const deletedMetadataValues = Object.assign({}, metadataValues);

    deletedMetadataValues['meta-data/instance-id'] = undefined;
    deletedMetadataValues['dynamic/instance-identity/document'] = undefined;

    parser.update(deletedMetadataValues);
    expect(parser.properties).to.not.have.property('instance-id');
    expect(parser.properties.identity).to.not.have.property('document');
    expect(parser.properties).to.not.have.property('account');
    expect(parser.properties).to.not.have.property('region');
  });
});

describe('Metadata / ASG API calls', function () {
  const metadataPaths = require('./data/metadata-paths.json');
  let metadataServiceSpy = sinon.spy();
  let asgSpy = sinon.spy();

  before(function () {
    nock.disableNetConnect();
  });

  beforeEach(function () {
    AWS_MOCK.setSDKInstance(AWS_SDK);
  });

  afterEach(function () {
    AWS_MOCK.restore();
    metadataServiceSpy.reset();
    asgSpy.reset();
  });

  after(function () {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it('should handle AWS MetaDataService error from the AWS SDK gracefully by not exposing the property', function () {
    AWS_MOCK.mock('MetadataService', 'request', function (path, callback) {
      metadataServiceSpy();
      callback(new Error('some error from the AWS SDK'), null);
    });

    const source = new Metadata({
      interval: 100
    });

    return source.initialize()
      .then(function () {
        expect(metadataServiceSpy.called).to.be.true;
        expect(source.properties).to.be.a('object');
        expect(source.properties).to.be.empty;
      });
  });

  it('should handle ASG errors from the AWS SDK by not surfacing the auto-scaling-group property', function () {
    AWS_MOCK.mock('MetadataService', 'request', function (path, callback) {
      metadataServiceSpy();
      callback(null, metadataPaths[path]);
    });

    AWS_MOCK.mock('AutoScaling', 'describeAutoScalingInstances', function (params, callback) {
      asgSpy();
      callback(new Error('some error from the AWS SDK'), null);
    });

    const source = new Metadata({
      interval: 100
    });

    return source.initialize()
      .then(function () {
        expect(metadataServiceSpy.called).to.be.true;
        expect(asgSpy.calledOnce).to.be.true;
        expect(source.properties['auto-scaling-group']).to.be.undefined;
      });
  });

  it('should retrieve ASG info for the instance', function () {
    AWS_MOCK.mock('MetadataService', 'request', function (path, callback) {
      metadataServiceSpy();
      callback(null, metadataPaths[path]);
    });

    AWS_MOCK.mock('AutoScaling', 'describeAutoScalingInstances', function (params, callback) {
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
      .then(function () {
        expect(metadataServiceSpy.called).to.be.true;
        expect(asgSpy.calledOnce).to.be.true;
        expect(source.properties.account).to.be.a('string');
        expect(source.properties.region).to.be.a('string');
        expect(source.properties['vpc-id']).to.be.a('string');
        expect(source.properties['iam-role']).to.eq('fake-fake');
        expect(source.properties['instance-id']).to.be.a('string');
        expect(source.properties.identity).to.be.an('object');
        expect(source.properties.credentials).to.be.an('object');
        expect(source.properties.interface).to.be.an('object');
        expect(source.properties['auto-scaling-group']).to.be.a('string');
        expect(source.properties['auto-scaling-group']).to.equal('my-cool-auto-scaling-group');
      });
  });

  it('periodically fetches metadata / ASG info from the EC2 metadata / ASG API', function () {
    AWS_MOCK.mock('MetadataService', 'request', function (path, callback) {
      metadataServiceSpy();
      callback(null, metadataPaths[path]);
    });

    AWS_MOCK.mock('AutoScaling', 'describeAutoScalingInstances', function (params, callback) {
      asgSpy();
      callback(null, { AutoScalingInstances: [] });
    });

    const source = new Metadata({
      interval: 100
    });

    let metadataInitialCallCount;

    return source.initialize()
      .then(function () {
        metadataInitialCallCount = metadataServiceSpy.callCount;
        expect(metadataServiceSpy.called).to.be.true;
        expect(asgSpy.calledOnce).to.be.true;
      })
      .then(function () {
        return new Promise((resolve) => { setTimeout(resolve, 1000) })
      })
      .then(function () {
        expect(metadataServiceSpy.callCount).to.be.above(metadataInitialCallCount);
        expect(asgSpy.calledOnce).to.be.false;
      });
  });

  it('should only retrieve ASG data once', function () {
    AWS_MOCK.mock('MetadataService', 'request', function (path, callback) {
      callback(null, metadataPaths[path]);
    });

    AWS_MOCK.mock('AutoScaling', 'describeAutoScalingInstances', function (params, callback) {
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
      .then(function () {
        expect(asgSpy.calledOnce).to.be.true;
      })
      .then(function () {
        return new Promise(function (resolve) { setTimeout(resolve, 1000) })
      })
      .then(function () {
        expect(asgSpy.calledOnce).to.be.true;
      });
  });
});
